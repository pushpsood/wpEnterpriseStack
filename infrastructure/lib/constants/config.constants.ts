/**
 * MISSION CRITICAL CONFIGURATION - ap-south-1 (Mumbai)
 * Centralizes all environment variables, domains, origin verification, and governance.
 */

/** Environment-specific values that differ between test and prod stages. */
export interface EnvConfig {
    ENV_NAME: string;
    ADMIN_INSTANCE_TYPE: string;
    MAX_AZS: number;
    BUDGET_AMOUNT: number;
    ALERT_EMAIL: string;
    PRIMARY_DOMAIN: string;
    ADDITIONAL_DOMAINS: string[];
    ADMIN_DOMAIN: string;
    CLOUDFRONT_CERTIFICATE_ARN?: string;    // ACM cert in us-east-1 for public domains
}

/** Test stage configuration. */
export const TEST_ENV_CONFIG: EnvConfig = {
    ENV_NAME: 'test',
    ADMIN_INSTANCE_TYPE: 't4g.micro',
    MAX_AZS: 2,
    BUDGET_AMOUNT: 20,
    ALERT_EMAIL: 'test-alerts@infoherd.com',
    PRIMARY_DOMAIN: 'test.infoherd.com',
    ADDITIONAL_DOMAINS: [],
    ADMIN_DOMAIN: 'admin-test.infoherd.com',
};

/** Production stage: infoherd.com, infoherd.in redirect, and protected admin.infoherd.com */
export const PROD_ENV_CONFIG: EnvConfig = {
    ENV_NAME: 'prod',
    ADMIN_INSTANCE_TYPE: 't4g.small',
    MAX_AZS: 2,
    BUDGET_AMOUNT: 30,
    ALERT_EMAIL: 'ops-alerts@infoherd.com',
    PRIMARY_DOMAIN: 'infoherd.com',
    ADDITIONAL_DOMAINS: [
        'www.infoherd.com',
        'infoherd.in',
        'www.infoherd.in'
    ],
    ADMIN_DOMAIN: 'admin.infoherd.com',
};

export const WP_CONFIG = {
    ACCOUNT: '851725215059',
    REGION: 'ap-south-1',
    VPC_CIDR: '10.0.0.0/16',

    // Compute - Graviton ARM (Best price/performance for PHP/Admin)
    ADMIN_INSTANCE_TYPE: 't4g.small',

    // Governance & Compliance
    ALERT_EMAIL: 'ops-alerts@infoherd.com',
    BUDGET_AMOUNT: 30,
    KMS_ALIAS: 'alias/wp-enterprise-kms',

    // AWS CloudFront Managed Prefix List for ap-south-1 (Mumbai) - IPv4 origin-facing
    CLOUDFRONT_PREFIX_LIST_IPV4: 'pl-9aa247f3',
    ADMIN_VERIFY_SECRET: 'wp-enterprise-admin-secret-2026',

    // Automated Backups
    BACKUP_CRON: 'cron(0 21 * * ? *)', // 2:30 AM IST = 21:00 UTC
};

export const PIPELINE_CONFIG = {
    PIPELINE_NAME: 'wp-enterprise-cdk-pipeline',
    GITHUB_OWNER: 'pushpsood',
    GITHUB_REPO: 'wpEnterpriseStack',
    GITHUB_BRANCH: 'main',
    // AWS CodeConnections connection ARN (status: AVAILABLE)
    CONNECTION_ARN: 'arn:aws:codeconnections:ap-south-1:851725215059:connection/32bd3466-ff65-440c-8193-2e6548416cd0',
};
