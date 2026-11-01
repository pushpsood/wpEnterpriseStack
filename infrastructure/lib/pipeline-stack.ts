import { Stack, type StackProps } from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import {
    CodePipeline,
    CodePipelineSource,
    ShellStep,
} from 'aws-cdk-lib/pipelines';
import { WPAppStage } from './wp-app-stage';
import { PROD_ENV_CONFIG, WP_CONFIG, PIPELINE_CONFIG } from './constants/index';

/**
 * Single-stage, self-mutating CDK Pipeline for the Static WordPress Enterprise Stack.
 *
 * Flow:
 *   Source (GitHub main via AWS CodeConnections)
 *     ──▶ Synth & Automated Tests
 *     ──▶ Deploy Single Production Stage (infoherd.com + infoherd.in redirect + admin.infoherd.com)
 */
export class WPPipelineStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        const pipeline = new CodePipeline(this, 'WPPipeline', {
            pipelineName: PIPELINE_CONFIG.PIPELINE_NAME,
            crossAccountKeys: false,
            synth: new ShellStep('Synth', {
                input: CodePipelineSource.connection(
                    `${PIPELINE_CONFIG.GITHUB_OWNER}/${PIPELINE_CONFIG.GITHUB_REPO}`,
                    PIPELINE_CONFIG.GITHUB_BRANCH,
                    {
                        connectionArn: PIPELINE_CONFIG.CONNECTION_ARN,
                    }
                ),
                commands: [
                    'cd infrastructure',
                    'npm ci',
                    'npx cdk synth',
                ],
                primaryOutputDirectory: 'infrastructure/cdk.out',
            }),
        });

        // ── Single Production Stage ──────────────────────────────────────────
        const prodStage = new WPAppStage(this, 'Prod', {
            envConfig: PROD_ENV_CONFIG,
            env: { account: this.account || WP_CONFIG.ACCOUNT, region: WP_CONFIG.REGION },
        });

        pipeline.addStage(prodStage);
    }
}
