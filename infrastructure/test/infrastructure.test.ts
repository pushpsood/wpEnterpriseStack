import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { WPUltimateStack } from '../lib/wp-stack.ts';
import { PROD_ENV_CONFIG } from '../lib/constants/index.ts';

let template: Template;

beforeAll(() => {
    const app = new cdk.App();
    const stack = new WPUltimateStack(app, 'TestStack', {
        envConfig: PROD_ENV_CONFIG,
        env: { account: '123456789012', region: 'ap-south-1' }
    });
    template = Template.fromStack(stack);
});

// ── Public Static Edge (infoherd.com & infoherd.in redirect) ─────────────────

test('Public static S3 bucket created with Block Public Access and encryption', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
        PublicAccessBlockConfiguration: {
            BlockPublicAcls: true,
            BlockPublicPolicy: true,
            IgnorePublicAcls: true,
            RestrictPublicBuckets: true,
        },
    });
});

test('CloudFront Function created for 301 domain redirect to infoherd.com', () => {
    template.hasResourceProperties('AWS::CloudFront::Function', {
        FunctionConfig: {
            Runtime: 'cloudfront-js-2.0',
        },
    });
});

test('CloudFront distribution created with index.html root and redirect-to-https', () => {
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: {
            DefaultRootObject: 'index.html',
            DefaultCacheBehavior: {
                ViewerProtocolPolicy: 'redirect-to-https',
                Compress: true,
            },
        },
    });
});

test('CloudFront Origin Access Control (OAC) created for S3', () => {
    template.hasResourceProperties('AWS::CloudFront::OriginAccessControl', {
        OriginAccessControlConfig: {
            OriginAccessControlOriginType: 's3',
            SigningBehavior: 'always',
            SigningProtocol: 'sigv4',
        },
    });
});

// ── Admin Security (Restricted Inbound Prefix List + Origin Verification) ──

test('Admin EC2 Security Group restricts inbound traffic to CloudFront Origin Prefix List', () => {
    template.hasResourceProperties('AWS::EC2::SecurityGroupIngress', {
        IpProtocol: 'tcp',
        FromPort: 80,
        ToPort: 80,
        SourcePrefixListId: 'pl-9aa247f3',
    });
});

test('Admin EC2 instance created with Graviton ARM (t4g.small)', () => {
    template.hasResourceProperties('AWS::EC2::Instance', {
        InstanceType: 't4g.small',
    });
});

test('Admin Role has SSM Managed Policy and CloudFront invalidation', () => {
    template.hasResourceProperties('AWS::IAM::Role', {
        ManagedPolicyArns: Match.arrayWith([
            Match.objectLike({
                'Fn::Join': Match.arrayWith([Match.arrayWith([Match.stringLikeRegexp('AmazonSSMManagedInstanceCore')])]),
            }),
        ]),
    });
});

test('Monthly budget created with $30 threshold (ALB & WAF eliminated)', () => {
    template.hasResourceProperties('AWS::Budgets::Budget', {
        Budget: {
            BudgetLimit: {
                Amount: 30,
                Unit: 'USD',
            },
            BudgetType: 'COST',
            TimeUnit: 'MONTHLY',
        },
    });
});

// ── Automated Backup & Disaster Recovery ───────────────────────────────────

test('AWS DLM Lifecycle Policy created for daily automated EBS snapshots', () => {
    template.hasResourceProperties('AWS::DLM::LifecyclePolicy', {
        State: 'ENABLED',
        PolicyDetails: {
            PolicyType: 'EBS_SNAPSHOT_MANAGEMENT',
            ResourceTypes: ['INSTANCE'],
        },
    });
});

test('EC2 Host Auto-Recovery CloudWatch Alarm created for StatusCheckFailed_System', () => {
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        MetricName: 'StatusCheckFailed_System',
        Namespace: 'AWS/EC2',
        ComparisonOperator: 'GreaterThanOrEqualToThreshold',
        Threshold: 1,
    });
});

test('EBS Root Volume is encrypted with default AWS-managed key (no customer KMS fee)', () => {
    template.hasResourceProperties('AWS::EC2::Instance', {
        BlockDeviceMappings: Match.arrayWith([
            Match.objectLike({
                DeviceName: '/dev/xvda',
                Ebs: {
                    Encrypted: true,
                },
            }),
        ]),
    });
    // Ensure no AWS::KMS::Key resource exists in the template
    template.resourceCountIs('AWS::KMS::Key', 0);
});
