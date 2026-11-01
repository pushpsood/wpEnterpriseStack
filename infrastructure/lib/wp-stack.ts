import { Stack, type StackProps, Duration, RemovalPolicy, Tags, CfnOutput } from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import {
    Vpc,
    SubnetType,
    Instance,
    InstanceType,
    MachineImage,
    AmazonLinuxCpuType,
    SecurityGroup,
    BlockDeviceVolume,
    GatewayVpcEndpointAwsService,
    IpAddresses,
    Peer,
    Port
} from 'aws-cdk-lib/aws-ec2';
import {
    Bucket,
    BucketEncryption,
    BlockPublicAccess,
    ObjectOwnership
} from 'aws-cdk-lib/aws-s3';
import {
    Distribution,
    ViewerProtocolPolicy,
    CachePolicy,
    OriginRequestPolicy,
    AllowedMethods,
    OriginProtocolPolicy,
    CfnOriginAccessControl,
    CfnDistribution,
    Function as CloudFrontFunction,
    FunctionCode,
    FunctionEventType
} from 'aws-cdk-lib/aws-cloudfront';
import { S3Origin, HttpOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { Certificate, type ICertificate } from 'aws-cdk-lib/aws-certificatemanager';
import { HostedZone, ARecord, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets';
import {
    Role,
    ServicePrincipal,
    ManagedPolicy,
    PolicyStatement
} from 'aws-cdk-lib/aws-iam';
import { Topic } from 'aws-cdk-lib/aws-sns';
import { EmailSubscription } from 'aws-cdk-lib/aws-sns-subscriptions';
import { CfnBudget } from 'aws-cdk-lib/aws-budgets';
import { CfnLifecyclePolicy } from 'aws-cdk-lib/aws-dlm';
import { CfnAlarm } from 'aws-cdk-lib/aws-cloudwatch';
import {
    WP_CONFIG,
    RESOURCE_NAMES,
    IAM_CONSTANTS,
    USERDATA_CONSTANTS,
    BUDGET_CONSTANTS,
    TAGS_CONSTANTS,
    type EnvConfig
} from './constants';

export interface WPUltimateStackProps extends StackProps {
    readonly envConfig: EnvConfig;
    readonly certificate?: ICertificate;
    readonly adminCertificate?: ICertificate;
}

export class WPUltimateStack extends Stack {
    readonly cloudFrontDomainOutput: CfnOutput;
    readonly publicBucketOutput: CfnOutput;
    readonly adminDomainOutput: CfnOutput;
    readonly adminInstanceIdOutput: CfnOutput;

    constructor(scope: Construct, id: string, props: WPUltimateStackProps) {
        super(scope, id, props);
        const { envConfig } = props;

        // 1. COMPLIANCE & LOGGING

        const logBucket = new Bucket(this, RESOURCE_NAMES.LOGS_BUCKET, {
            encryption: BucketEncryption.S3_MANAGED,
            removalPolicy: RemovalPolicy.RETAIN,
            blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
            enforceSSL: true,
            objectOwnership: ObjectOwnership.OBJECT_WRITER
        });

        // 2. PUBLIC STATELESS STATIC EDGE (S3 + CloudFront)
        const publicStaticBucket = new Bucket(this, RESOURCE_NAMES.PUBLIC_STATIC_BUCKET, {
            encryption: BucketEncryption.S3_MANAGED,
            blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
            removalPolicy: envConfig.ENV_NAME === 'prod' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
            autoDeleteObjects: envConfig.ENV_NAME !== 'prod',
            enforceSSL: true
        });

        // CloudFront Origin Access Control (OAC)
        const oac = new CfnOriginAccessControl(this, RESOURCE_NAMES.CLOUDFRONT_OAC, {
            originAccessControlConfig: {
                name: `${envConfig.ENV_NAME}-wp-static-oac`,
                originAccessControlOriginType: 's3',
                signingBehavior: 'always',
                signingProtocol: 'sigv4',
                description: 'OAC for Static WordPress S3 bucket'
            }
        });

        // CloudFront Function: 301 Redirect for alternate domains & Subdirectory index.html rewrite for S3 OAC
        const domainRedirectFunction = new CloudFrontFunction(this, RESOURCE_NAMES.DOMAIN_REDIRECT_FUNCTION, {
            code: FunctionCode.fromInline(`
function handler(event) {
    var request = event.request;
    var host = request.headers.host ? request.headers.host.value : '';
    var primaryDomain = '${envConfig.PRIMARY_DOMAIN}';

    // Redirect infoherd.in and www.* to https://infoherd.com (preserving path and query parameters)
    if (host && host !== primaryDomain) {
        var queryParams = [];
        if (request.querystring) {
            for (var key in request.querystring) {
                if (request.querystring[key].value) {
                    queryParams.push(key + '=' + request.querystring[key].value);
                } else {
                    queryParams.push(key);
                }
            }
        }
        var queryString = queryParams.length > 0 ? '?' + queryParams.join('&') : '';
        return {
            statusCode: 301,
            statusDescription: 'Moved Permanently',
            headers: {
                'location': { value: 'https://' + primaryDomain + request.uri + queryString }
            }
        };
    }

    // Rewrite directory paths (e.g. /about/ or /2018/post/) to append index.html for S3 OAC
    var uri = request.uri;
    if (uri.endsWith('/')) {
        request.uri += 'index.html';
    } else if (!uri.includes('.')) {
        request.uri += '/index.html';
    }

    return request;
}
`)
        });

        const allPublicDomains = [envConfig.PRIMARY_DOMAIN, ...envConfig.ADDITIONAL_DOMAINS];
        const cloudFrontCert = props.certificate ?? (envConfig.CLOUDFRONT_CERTIFICATE_ARN
            ? Certificate.fromCertificateArn(this, 'CloudFrontCert', envConfig.CLOUDFRONT_CERTIFICATE_ARN)
            : undefined);

        // Public CloudFront Distribution for Static Site
        const distribution = new Distribution(this, RESOURCE_NAMES.CLOUDFRONT_DISTRIBUTION, {
            domainNames: cloudFrontCert ? allPublicDomains : undefined,
            certificate: cloudFrontCert,
            defaultBehavior: {
                origin: new S3Origin(publicStaticBucket),
                viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                cachePolicy: CachePolicy.CACHING_OPTIMIZED,
                compress: true,
                functionAssociations: [
                    {
                        function: domainRedirectFunction,
                        eventType: FunctionEventType.VIEWER_REQUEST
                    }
                ]
            },
            defaultRootObject: 'index.html',
            errorResponses: [
                {
                    httpStatus: 404,
                    responseHttpStatus: 404,
                    responsePagePath: '/404.html',
                    ttl: Duration.minutes(5)
                },
                {
                    httpStatus: 403,
                    responseHttpStatus: 404,
                    responsePagePath: '/404.html',
                    ttl: Duration.minutes(5)
                }
            ],
            logBucket,
            logFilePrefix: 'cloudfront-access-logs/'
        });

        // Attach OAC to CloudFront distribution S3 Origin and clear legacy OAI
        const cfnDistribution = distribution.node.defaultChild as CfnDistribution;
        cfnDistribution.addPropertyOverride(
            'DistributionConfig.Origins.0.OriginAccessControlId',
            oac.attrId
        );
        cfnDistribution.addPropertyOverride(
            'DistributionConfig.Origins.0.S3OriginConfig.OriginAccessIdentity',
            ''
        );

        // S3 Bucket Policy allowing CloudFront OAC read access
        publicStaticBucket.addToResourcePolicy(new PolicyStatement({
            actions: ['s3:GetObject'],
            resources: [publicStaticBucket.arnForObjects('*')],
            principals: [new ServicePrincipal('cloudfront.amazonaws.com')],
            conditions: {
                StringEquals: {
                    'AWS:SourceArn': `arn:aws:cloudfront::${this.account}:distribution/${distribution.distributionId}`
                }
            }
        }));

        // Route 53 Hosted Zones
        const infoherdComZone = HostedZone.fromHostedZoneAttributes(this, 'InfoherdComZoneApex', {
            hostedZoneId: 'Z0315855308LUCEV9VMDP',
            zoneName: 'infoherd.com',
        });

        const infoherdInZone = HostedZone.fromHostedZoneAttributes(this, 'InfoherdInZoneApex', {
            hostedZoneId: 'Z0332917225YCOEBV45H6',
            zoneName: 'infoherd.in',
        });

        // 1. Apex infoherd.com -> Public CloudFront
        new ARecord(this, 'InfoherdComApexRecord', {
            zone: infoherdComZone,
            target: RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
        });

        // 2. Apex infoherd.in -> Public CloudFront
        new ARecord(this, 'InfoherdInApexRecord', {
            zone: infoherdInZone,
            target: RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
        });

        // 3. www.infoherd.in -> Public CloudFront
        new ARecord(this, 'InfoherdInWwwRecord', {
            zone: infoherdInZone,
            recordName: 'www',
            target: RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
        });

        // 3. ADMIN NETWORK (Restricted to CloudFront Origin Edge Only)
        const vpc = new Vpc(this, RESOURCE_NAMES.VPC, {
            ipAddresses: IpAddresses.cidr(WP_CONFIG.VPC_CIDR),
            maxAzs: envConfig.MAX_AZS,
            natGateways: 0,
            subnetConfiguration: [
                {
                    cidrMask: 24,
                    name: 'Admin-Public',
                    subnetType: SubnetType.PUBLIC
                }
            ]
        });
        vpc.addGatewayEndpoint(RESOURCE_NAMES.S3_GATEWAY, {
            service: GatewayVpcEndpointAwsService.S3
        });

        // Security Group for Admin EC2: Only allow inbound HTTP from AWS CloudFront Managed Prefix Lists
        // General public internet traffic to EC2 is completely blocked!
        const adminSg = new SecurityGroup(this, RESOURCE_NAMES.ADMIN_SG, {
            vpc,
            description: 'Security group for Admin EC2 (Inbound restricted exclusively to CloudFront origin edge)',
            allowAllOutbound: true
        });

        adminSg.addIngressRule(
            Peer.prefixList(WP_CONFIG.CLOUDFRONT_PREFIX_LIST_IPV4),
            Port.tcp(80),
            'Allow HTTP only from CloudFront IPv4 origin-facing edge'
        );

        // 4. ADMIN COMPUTE & IAM ROLE
        const adminRole = new Role(this, RESOURCE_NAMES.ADMIN_ROLE, {
            assumedBy: new ServicePrincipal('ec2.amazonaws.com'),
            managedPolicies: [
                ManagedPolicy.fromAwsManagedPolicyName(IAM_CONSTANTS.SSM_MANAGED_INSTANCE_CORE)
            ]
        });

        // Grant Admin instance write access to Public Static S3 bucket
        publicStaticBucket.grantReadWrite(adminRole);

        // Grant Admin instance permission to invalidate CloudFront caches on publish
        adminRole.addToPolicy(new PolicyStatement({
            actions: ['cloudfront:CreateInvalidation', 'cloudfront:GetInvalidation'],
            resources: [`arn:aws:cloudfront::${this.account}:distribution/*`]
        }));

        // EC2 Admin Instance (Graviton ARM)
        const adminInstance = new Instance(this, RESOURCE_NAMES.ADMIN_INSTANCE, {
            vpc,
            instanceType: new InstanceType(envConfig.ADMIN_INSTANCE_TYPE),
            machineImage: MachineImage.latestAmazonLinux2023({
                cpuType: AmazonLinuxCpuType.ARM_64
            }),
            securityGroup: adminSg,
            role: adminRole,
            blockDevices: [
                {
                    deviceName: '/dev/xvda',
                    volume: BlockDeviceVolume.ebs(20, {
                        encrypted: true
                    })
                }
            ]
        });

        // 5. PROTECTED ADMIN CLOUDFRONT DISTRIBUTION (admin.infoherd.com)
        // Uses dedicated ACM SSL cert for admin.infoherd.com in us-east-1 and proxies to EC2
        const adminCert = props.adminCertificate ?? cloudFrontCert;
        const adminDistribution = new Distribution(this, 'WPAdminDistribution', {
            domainNames: adminCert ? [envConfig.ADMIN_DOMAIN] : undefined,
            certificate: adminCert,
            defaultBehavior: {
                origin: new HttpOrigin(adminInstance.instancePublicDnsName, {
                    protocolPolicy: OriginProtocolPolicy.HTTP_ONLY,
                    httpPort: 80,
                    customHeaders: {
                        'X-Admin-Verify': WP_CONFIG.ADMIN_VERIFY_SECRET
                    }
                }),
                viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                cachePolicy: CachePolicy.CACHING_DISABLED,
                originRequestPolicy: OriginRequestPolicy.ALL_VIEWER,
                allowedMethods: AllowedMethods.ALLOW_ALL,
            },
        });

        // Route 53 A-Record Alias for admin.infoherd.com -> Admin CloudFront
        new ARecord(this, 'AdminAliasRecord', {
            zone: infoherdComZone,
            recordName: 'admin',
            target: RecordTarget.fromAlias(new CloudFrontTarget(adminDistribution)),
        });

        // 6. USERDATA: WORDPRESS, MARIA DB, PAGEFIND, NGINX & STATIC PUBLISHER
        const nginxConfigContent = `
server {
    listen 80 default_server;
    server_name ${envConfig.ADMIN_DOMAIN} localhost _;
    root ${USERDATA_CONSTANTS.WORDPRESS_ROOT};
    index index.php index.html;

    client_max_body_size 64M;

    # Restrict access to CloudFront distribution or local requests
    set $auth_ok 0;
    if ($remote_addr = "127.0.0.1") {
        set $auth_ok 1;
    }
    if ($remote_addr = "::1") {
        set $auth_ok 1;
    }
    if ($http_x_admin_verify = "${WP_CONFIG.ADMIN_VERIFY_SECRET}") {
        set $auth_ok 1;
    }
    if ($auth_ok = 0) {
        return 403;
    }

    location / {
        try_files $uri $uri/ /index.php?$args;
    }

    location ~ \\.php$ {
        include fastcgi_params;
        fastcgi_pass unix:/run/php-fpm/www.sock;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        fastcgi_param HTTPS on;
    }
}
`;

        const publishScriptContent = `#!/bin/bash
set -euo pipefail

STATIC_DIR="${USERDATA_CONSTANTS.STATIC_OUTPUT_ROOT}"
PUBLIC_BUCKET="${publicStaticBucket.bucketName}"
DIST_ID="${distribution.distributionId}"
PRIMARY_DOMAIN="${envConfig.PRIMARY_DOMAIN}"
ADMIN_DOMAIN="${envConfig.ADMIN_DOMAIN}"

# Auto-backup database & uploads to S3 before static publishing
if [ -x "${USERDATA_CONSTANTS.BACKUP_SCRIPT}" ]; then
    echo "[$(date)] Triggering automated backup before static export..."
    ${USERDATA_CONSTANTS.BACKUP_SCRIPT} || echo "Backup warning before publish"
fi

echo "[$(date)] Starting static export for https://$PRIMARY_DOMAIN..."
mkdir -p "$STATIC_DIR/site"

# Crawl WordPress admin to generate clean static HTML/CSS/JS
wget --mirror --convert-links --adjust-extension --page-requisites --no-parent \\
     --directory-prefix="$STATIC_DIR/temp" \\
     --reject="*wp-admin*,*wp-login*,*xmlrpc*,*feed*,*comments*,*replytocom*,*filter_by*,*share=*" \\
     https://$ADMIN_DOMAIN/ || true

if [ -d "$STATIC_DIR/temp/$ADMIN_DOMAIN" ]; then
    rsync -aq --delete "$STATIC_DIR/temp/$ADMIN_DOMAIN/" "$STATIC_DIR/site/"
    rm -rf "$STATIC_DIR/temp"
fi

# Explicitly fetch robots.txt and sitemaps generated by SEO plugins
wget -q -O "$STATIC_DIR/site/robots.txt" https://$ADMIN_DOMAIN/robots.txt 2>/dev/null || true
wget -q -O "$STATIC_DIR/site/sitemap.xml" https://$ADMIN_DOMAIN/sitemap.xml 2>/dev/null || true
wget -q -O "$STATIC_DIR/site/sitemap_index.xml" https://$ADMIN_DOMAIN/sitemap_index.xml 2>/dev/null || true

# Rewrite any internal admin links to canonical public domain https://infoherd.com
if [ -d "$STATIC_DIR/site" ]; then
    find "$STATIC_DIR/site" -type f \\( -name "*.html" -o -name "*.xml" -o -name "*.json" \\) \\
         -exec sed -i "s|https://$ADMIN_DOMAIN|https://$PRIMARY_DOMAIN|g" {} + 2>/dev/null || true
    find "$STATIC_DIR/site" -type f \\( -name "*.html" -o -name "*.xml" -o -name "*.json" \\) \\
         -exec sed -i "s|http://$ADMIN_DOMAIN|https://$PRIMARY_DOMAIN|g" {} + 2>/dev/null || true
fi

# Run Pagefind to compile chunked search index
if command -v pagefind &> /dev/null && [ -d "$STATIC_DIR/site" ]; then
    echo "[$(date)] Building Pagefind search index..."
    pagefind --site "$STATIC_DIR/site" || echo "Pagefind indexed with warnings"
fi

# 1. Sync dynamic static HTML pages to S3
echo "[$(date)] Syncing static HTML pages to s3://$PUBLIC_BUCKET..."
aws s3 sync "$STATIC_DIR/site" "s3://$PUBLIC_BUCKET"

# 2. Sync full pristine asset trees directly from WordPress installation
echo "[$(date)] Syncing static assets (themes, plugins, uploads, super-sidebar)..."
aws s3 sync "${USERDATA_CONSTANTS.WORDPRESS_ROOT}/wp-content" "s3://$PUBLIC_BUCKET/wp-content"
aws s3 sync "${USERDATA_CONSTANTS.WORDPRESS_ROOT}/wp-includes" "s3://$PUBLIC_BUCKET/wp-includes"
if [ -d "${USERDATA_CONSTANTS.WORDPRESS_ROOT}/super-sidebar" ]; then
    aws s3 sync "${USERDATA_CONSTANTS.WORDPRESS_ROOT}/super-sidebar" "s3://$PUBLIC_BUCKET/super-sidebar"
fi
if [ -f "${USERDATA_CONSTANTS.WORDPRESS_ROOT}/ads.txt" ]; then
    aws s3 cp "${USERDATA_CONSTANTS.WORDPRESS_ROOT}/ads.txt" "s3://$PUBLIC_BUCKET/ads.txt"
fi
if [ -d "${USERDATA_CONSTANTS.WORDPRESS_ROOT}/zohoverify" ]; then
    aws s3 sync "${USERDATA_CONSTANTS.WORDPRESS_ROOT}/zohoverify" "s3://$PUBLIC_BUCKET/zohoverify"
fi

# Invalidate CloudFront cache
if [ -n "$DIST_ID" ]; then
    echo "[$(date)] Invalidating CloudFront distribution $DIST_ID..."
    aws cloudfront create-invalidation --distribution-id "$DIST_ID" --paths "/*"
fi

echo "[$(date)] Static publishing complete for https://$PRIMARY_DOMAIN!"
`;

        const backupScriptContent = `#!/bin/bash
set -euo pipefail

BACKUP_DIR="/tmp/wp-backups"
PUBLIC_BUCKET="${publicStaticBucket.bucketName}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

# 1. Dump MariaDB WordPress database
if mysql -u root -e "USE wordpress;" 2>/dev/null; then
    echo "[$(date)] Dumping WordPress database..."
    mysqldump -u root --single-transaction --quick wordpress | gzip > "$BACKUP_DIR/latest-db.sql.gz"
    cp "$BACKUP_DIR/latest-db.sql.gz" "$BACKUP_DIR/db-$TIMESTAMP.sql.gz"
fi

# 2. Archive wp-content uploads
if [ -d "${USERDATA_CONSTANTS.WORDPRESS_ROOT}/wp-content/uploads" ]; then
    echo "[$(date)] Archiving wp-content uploads..."
    tar -czf "$BACKUP_DIR/latest-uploads.tar.gz" -C "${USERDATA_CONSTANTS.WORDPRESS_ROOT}/wp-content" uploads 2>/dev/null || true
fi

# 3. Archive custom themes, plugins, super-sidebar, ads.txt, and zohoverify
echo "[$(date)] Archiving custom assets..."
tar -czf "$BACKUP_DIR/latest-custom-assets.tar.gz" -C "${USERDATA_CONSTANTS.WORDPRESS_ROOT}" \
    wp-content/themes wp-content/plugins super-sidebar ads.txt zohoverify 2>/dev/null || true

# 4. Upload to S3 backups prefix
echo "[$(date)] Uploading backups to s3://$PUBLIC_BUCKET/backups/..."
if [ -f "$BACKUP_DIR/latest-db.sql.gz" ]; then
    aws s3 cp "$BACKUP_DIR/latest-db.sql.gz" "s3://$PUBLIC_BUCKET/backups/latest-db.sql.gz"
    aws s3 cp "$BACKUP_DIR/db-$TIMESTAMP.sql.gz" "s3://$PUBLIC_BUCKET/backups/history/db-$TIMESTAMP.sql.gz"
fi
if [ -f "$BACKUP_DIR/latest-uploads.tar.gz" ]; then
    aws s3 cp "$BACKUP_DIR/latest-uploads.tar.gz" "s3://$PUBLIC_BUCKET/backups/latest-uploads.tar.gz"
fi
if [ -f "$BACKUP_DIR/latest-custom-assets.tar.gz" ]; then
    aws s3 cp "$BACKUP_DIR/latest-custom-assets.tar.gz" "s3://$PUBLIC_BUCKET/backups/latest-custom-assets.tar.gz"
fi

rm -rf "$BACKUP_DIR"
echo "[$(date)] Automated backup completed successfully."
`;

        const restoreScriptContent = `#!/bin/bash
set -euo pipefail

PUBLIC_BUCKET="${publicStaticBucket.bucketName}"
RESTORE_DIR="/tmp/wp-restore"

mkdir -p "$RESTORE_DIR"

echo "[$(date)] Checking for existing backups in s3://$PUBLIC_BUCKET/backups/..."
if aws s3 ls "s3://$PUBLIC_BUCKET/backups/latest-db.sql.gz" >/dev/null 2>&1; then
    echo "[$(date)] Found database backup in S3! Restoring..."
    aws s3 cp "s3://$PUBLIC_BUCKET/backups/latest-db.sql.gz" "$RESTORE_DIR/latest-db.sql.gz"
    mysql -u root -e "CREATE DATABASE IF NOT EXISTS wordpress DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    gunzip < "$RESTORE_DIR/latest-db.sql.gz" | mysql -u root wordpress
    echo "[$(date)] Database restored successfully."
else
    echo "[$(date)] No database backup found in S3."
fi

if aws s3 ls "s3://$PUBLIC_BUCKET/backups/latest-uploads.tar.gz" >/dev/null 2>&1; then
    echo "[$(date)] Found uploads backup in S3! Restoring..."
    aws s3 cp "s3://$PUBLIC_BUCKET/backups/latest-uploads.tar.gz" "$RESTORE_DIR/latest-uploads.tar.gz"
    mkdir -p "${USERDATA_CONSTANTS.WORDPRESS_ROOT}/wp-content"
    tar -xzf "$RESTORE_DIR/latest-uploads.tar.gz" -C "${USERDATA_CONSTANTS.WORDPRESS_ROOT}/wp-content/" 2>/dev/null || true
    echo "[$(date)] Uploads restored successfully."
fi

if aws s3 ls "s3://$PUBLIC_BUCKET/backups/latest-custom-assets.tar.gz" >/dev/null 2>&1; then
    echo "[$(date)] Found custom assets backup in S3! Restoring..."
    aws s3 cp "s3://$PUBLIC_BUCKET/backups/latest-custom-assets.tar.gz" "$RESTORE_DIR/latest-custom-assets.tar.gz"
    tar -xzf "$RESTORE_DIR/latest-custom-assets.tar.gz" -C "${USERDATA_CONSTANTS.WORDPRESS_ROOT}/" 2>/dev/null || true
    echo "[$(date)] Custom assets restored successfully."
fi

chown -R nginx:nginx ${USERDATA_CONSTANTS.WORDPRESS_ROOT}
rm -rf "$RESTORE_DIR"
echo "[$(date)] Restore procedure complete."
`;

        const muPluginContent = `<?php
/**
 * Plugin Name: Static WordPress Publisher
 * Description: Automatically triggers static export and Pagefind indexing on publish.
 */
function trigger_static_publish(): void {
    exec('${USERDATA_CONSTANTS.STATIC_PUBLISH_SCRIPT} > /tmp/publish-static.log 2>&1 &');
}
add_action('publish_post', 'trigger_static_publish');
add_action('publish_page', 'trigger_static_publish');
add_action('post_updated', function($post_id, $post_after, $post_before) {
    if ($post_after->post_status === 'publish') {
        trigger_static_publish();
    }
}, 10, 3);
add_action('deleted_post', 'trigger_static_publish');
`;

        adminInstance.userData.addCommands(
            USERDATA_CONSTANTS.INSTALL_PACKAGES,
            USERDATA_CONSTANTS.ENABLE_SERVICES,
            USERDATA_CONSTANTS.INSTALL_PAGEFIND,
            USERDATA_CONSTANTS.INSTALL_WP_CLI,

            `mkdir -p ${USERDATA_CONSTANTS.WORDPRESS_ROOT} ${USERDATA_CONSTANTS.STATIC_OUTPUT_ROOT} ${USERDATA_CONSTANTS.WP_MU_PLUGINS_PATH}`,

            // Configure MariaDB & Download WordPress core
            `mysql -e "CREATE DATABASE IF NOT EXISTS wordpress DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"`,
            `mysql -e "CREATE USER IF NOT EXISTS 'wp_user'@'localhost' IDENTIFIED BY 'wp_secure_pass_2026';"`,
            `mysql -e "GRANT ALL PRIVILEGES ON wordpress.* TO 'wp_user'@'localhost';"`,
            `mysql -e "FLUSH PRIVILEGES;"`,
            `if [ ! -f ${USERDATA_CONSTANTS.WORDPRESS_ROOT}/index.php ]; then (wp core download --path=${USERDATA_CONSTANTS.WORDPRESS_ROOT} --allow-root || (curl -sL https://wordpress.org/latest.tar.gz | tar -xz -C /tmp && cp -rn /tmp/wordpress/* ${USERDATA_CONSTANTS.WORDPRESS_ROOT}/ && rm -rf /tmp/wordpress)); fi`,
            `if [ ! -f ${USERDATA_CONSTANTS.WORDPRESS_ROOT}/wp-config.php ]; then wp config create --dbname=wordpress --dbuser=wp_user --dbpass=wp_secure_pass_2026 --dbhost=localhost --path=${USERDATA_CONSTANTS.WORDPRESS_ROOT} --allow-root; fi`,

            // Configure Nginx for WordPress behind CloudFront
            `cat << 'NGINX_EOF' > /etc/nginx/conf.d/wordpress.conf\n${nginxConfigContent}\nNGINX_EOF`,
            `systemctl restart nginx`,

            // Scripts & Permissions
            `cat << 'SCRIPT_EOF' > ${USERDATA_CONSTANTS.STATIC_PUBLISH_SCRIPT}\n${publishScriptContent}\nSCRIPT_EOF`,
            `chmod +x ${USERDATA_CONSTANTS.STATIC_PUBLISH_SCRIPT}`,
            `cat << 'BACKUP_EOF' > ${USERDATA_CONSTANTS.BACKUP_SCRIPT}\n${backupScriptContent}\nBACKUP_EOF`,
            `chmod +x ${USERDATA_CONSTANTS.BACKUP_SCRIPT}`,
            `cat << 'RESTORE_EOF' > ${USERDATA_CONSTANTS.RESTORE_SCRIPT}\n${restoreScriptContent}\nRESTORE_EOF`,
            `chmod +x ${USERDATA_CONSTANTS.RESTORE_SCRIPT}`,

            // Auto-restore database and uploads on boot if backup exists in S3
            `${USERDATA_CONSTANTS.RESTORE_SCRIPT} || echo "No previous backup restored"`,

            // Cron job for daily automated backup at midnight
            `echo "0 0 * * * root ${USERDATA_CONSTANTS.BACKUP_SCRIPT} >> /var/log/wp-backup.log 2>&1" > /etc/cron.d/wp-backup`,
            `chmod 644 /etc/cron.d/wp-backup`,

            `cat << 'MU_EOF' > ${USERDATA_CONSTANTS.WP_MU_PLUGINS_PATH}/static-publisher.php\n${muPluginContent}\nMU_EOF`,
            `chown -R nginx:nginx ${USERDATA_CONSTANTS.WORDPRESS_ROOT} ${USERDATA_CONSTANTS.STATIC_OUTPUT_ROOT}`
        );

        // 6. BACKUP & DISASTER RECOVERY (AWS DLM Daily Snapshots & EC2 Auto-Recovery)
        Tags.of(adminInstance).add('Backup', 'Daily');

        const dlmRole = new Role(this, 'WPDlmRole', {
            assumedBy: new ServicePrincipal('dlm.amazonaws.com'),
            managedPolicies: [
                ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSDataLifecycleManagerServiceRole')
            ]
        });

        new CfnLifecyclePolicy(this, 'WPEbsDailyBackupPolicy', {
            description: 'Automated daily EBS snapshot policy for WordPress EC2 instance',
            state: 'ENABLED',
            executionRoleArn: dlmRole.roleArn,
            policyDetails: {
                policyType: 'EBS_SNAPSHOT_MANAGEMENT',
                resourceTypes: ['INSTANCE'],
                targetTags: [{ key: 'Backup', value: 'Daily' }],
                schedules: [{
                    name: 'DailySnapshots',
                    createRule: {
                        interval: 24,
                        intervalUnit: 'HOURS',
                        times: ['03:00']
                    },
                    retainRule: {
                        count: 7
                    },
                    copyTags: true
                }]
            }
        });

        // Auto-Recovery CloudWatch Alarm for Physical Host Failure
        new CfnAlarm(this, 'AdminEC2AutoRecoveryAlarm', {
            alarmName: `${envConfig.ENV_NAME}-AdminEC2-AutoRecovery`,
            alarmDescription: 'Automatically recovers the EC2 instance if physical hardware fails',
            metricName: 'StatusCheckFailed_System',
            namespace: 'AWS/EC2',
            statistic: 'Maximum',
            dimensions: [{ name: 'InstanceId', value: adminInstance.instanceId }],
            period: 60,
            evaluationPeriods: 2,
            threshold: 1,
            comparisonOperator: 'GreaterThanOrEqualToThreshold',
            alarmActions: [`arn:aws:automate:${this.region}:ec2:recover`]
        });

        // 7. MONITORING & BUDGETS ($30/month)
        const alertTopic = new Topic(this, RESOURCE_NAMES.ALERT_TOPIC);
        alertTopic.addSubscription(new EmailSubscription(envConfig.ALERT_EMAIL));

        new CfnBudget(this, RESOURCE_NAMES.BUDGET, {
            budget: {
                budgetLimit: { amount: envConfig.BUDGET_AMOUNT, unit: BUDGET_CONSTANTS.CURRENCY_UNIT },
                budgetName: `${envConfig.ENV_NAME}-Static-WP-Budget`,
                budgetType: BUDGET_CONSTANTS.BUDGET_TYPE,
                timeUnit: BUDGET_CONSTANTS.TIME_UNIT
            },
            notificationsWithSubscribers: [{
                notification: {
                    comparisonOperator: BUDGET_CONSTANTS.COMPARISON_OPERATOR,
                    notificationType: BUDGET_CONSTANTS.NOTIFICATION_TYPE,
                    threshold: BUDGET_CONSTANTS.THRESHOLD_PERCENTAGE,
                    thresholdType: BUDGET_CONSTANTS.THRESHOLD_TYPE
                },
                subscribers: [{
                    subscriptionType: BUDGET_CONSTANTS.SUBSCRIPTION_TYPE,
                    address: envConfig.ALERT_EMAIL
                }]
            }]
        });

        // 8. CFN OUTPUTS
        this.cloudFrontDomainOutput = new CfnOutput(this, 'CloudFrontDomainName', {
            value: distribution.distributionDomainName,
            description: 'CloudFront distribution domain for infoherd.com & infoherd.in'
        });

        this.publicBucketOutput = new CfnOutput(this, 'PublicStaticBucket', {
            value: publicStaticBucket.bucketName,
            description: 'S3 Bucket hosting static website assets'
        });

        this.adminDomainOutput = new CfnOutput(this, 'AdminDomainName', {
            value: `https://${envConfig.ADMIN_DOMAIN}`,
            description: 'Protected Admin Domain URL (via AWS CloudFront & Route 53)'
        });

        this.adminInstanceIdOutput = new CfnOutput(this, 'AdminInstanceId', {
            value: adminInstance.instanceId,
            description: 'EC2 Instance ID for SSM Session Manager'
        });

        Tags.of(this).add(TAGS_CONSTANTS.PROJECT_KEY, TAGS_CONSTANTS.PROJECT_VALUE);
    }
}
