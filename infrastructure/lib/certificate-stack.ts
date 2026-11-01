import { Stack, type StackProps } from 'aws-cdk-lib/core';
import { Certificate, CertificateValidation } from 'aws-cdk-lib/aws-certificatemanager';
import { HostedZone } from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';

export interface DnsCertificateStackProps extends StackProps {
    primaryDomain: string;
    additionalDomains: string[];
    adminDomain?: string;
}

/**
 * Provisions the multi-domain SSL Certificate in us-east-1 (mandatory for CloudFront)
 * and validates it automatically using Route 53 DNS records across infoherd.com and infoherd.in.
 */
export class DnsCertificateStack extends Stack {
    readonly certificate: Certificate;
    readonly adminCertificate?: Certificate;

    constructor(scope: Construct, id: string, props: DnsCertificateStackProps) {
        super(scope, id, props);

        const infoherdComZone = HostedZone.fromHostedZoneAttributes(this, 'InfoherdComZone', {
            hostedZoneId: 'Z0315855308LUCEV9VMDP',
            zoneName: 'infoherd.com',
        });

        const infoherdInZone = HostedZone.fromHostedZoneAttributes(this, 'InfoherdInZone', {
            hostedZoneId: 'Z0332917225YCOEBV45H6',
            zoneName: 'infoherd.in',
        });

        this.certificate = new Certificate(this, 'CloudFrontCertificate', {
            domainName: props.primaryDomain,
            subjectAlternativeNames: props.additionalDomains,
            validation: CertificateValidation.fromDnsMultiZone({
                'infoherd.com': infoherdComZone,
                'www.infoherd.com': infoherdComZone,
                '*.infoherd.com': infoherdComZone,
                'infoherd.in': infoherdInZone,
                'www.infoherd.in': infoherdInZone,
                '*.infoherd.in': infoherdInZone,
            }),
        });

        if (props.adminDomain) {
            this.adminCertificate = new Certificate(this, 'AdminCertificate', {
                domainName: props.adminDomain,
                validation: CertificateValidation.fromDns(infoherdComZone),
            });
        }
    }
}

