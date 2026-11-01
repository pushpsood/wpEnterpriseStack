#!/usr/bin/env node
import { App } from 'aws-cdk-lib/core';
import { WPPipelineStack } from './pipeline-stack';
import { WP_CONFIG } from './constants/index';

const app = new App();

// Self-Mutating CI/CD Pipeline Stack:
// Everything is deployed via GitHub + AWS CodePipeline (single Prod stage).
new WPPipelineStack(app, 'WPPipelineStack', {
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT || WP_CONFIG.ACCOUNT,
        region: WP_CONFIG.REGION,
    },
});

app.synth();

