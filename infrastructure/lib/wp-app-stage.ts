import { Stage, type StageProps } from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import { WPUltimateStack } from './wp-stack';
import { DnsCertificateStack } from './certificate-stack';
import type { EnvConfig } from './constants/config.constants';
import { WP_CONFIG } from './constants/index';

export interface WPAppStageProps extends StageProps {
    envConfig: EnvConfig;
}

/**
 * CDK Stage that provisions the SSL Certificate in us-east-1 and
 * the full Static WordPress infrastructure in ap-south-1.
 */
export class WPAppStage extends Stage {
    readonly stack: WPUltimateStack;
    readonly certStack: DnsCertificateStack;

    constructor(scope: Construct, id: string, props: WPAppStageProps) {
        super(scope, id, props);

        const account = props.env?.account || WP_CONFIG.ACCOUNT;

        this.certStack = new DnsCertificateStack(this, `WPCert-${props.envConfig.ENV_NAME}`, {
            env: {
                account,
                region: 'us-east-1',
            },
            crossRegionReferences: true,
            primaryDomain: props.envConfig.PRIMARY_DOMAIN,
            additionalDomains: props.envConfig.ADDITIONAL_DOMAINS,
            adminDomain: props.envConfig.ADMIN_DOMAIN,
        });

        this.stack = new WPUltimateStack(this, `WP-${props.envConfig.ENV_NAME}`, {
            envConfig: props.envConfig,
            certificate: this.certStack.certificate,
            adminCertificate: this.certStack.adminCertificate,
            crossRegionReferences: true,
            env: {
                account,
                region: props.env?.region || WP_CONFIG.REGION,
            },
        });
    }
}
