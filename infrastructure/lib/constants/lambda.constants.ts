/**
 * Lambda Function Configuration
 * 
 * Defines Lambda handler paths and environment variable keys used across the stack.
 * 
 * Handler Format: 'package.class::method'
 * Environment Keys: Used to pass runtime configuration to Lambda functions
 * 
 * Variations:
 * - ORCHESTRATOR_HANDLER: Main barrier coordination logic
 * - JANITOR_HANDLER: Cleanup of orphaned resources
 */
export const LAMBDA_CONSTANTS = {
  // Handler Paths
  ORCHESTRATOR_HANDLER: 'com.wp.orchestrator.Handler::handleRequest',
  JANITOR_HANDLER: 'com.wp.orchestrator.Janitor::handleRequest',
  
  // Environment Variable Keys
  ENV_TABLE_NAME: 'TABLE_NAME',
  ENV_TOPIC_ARN: 'TOPIC_ARN',
  ENV_ASG_NAME: 'ASG_NAME',
  ENV_TIMEOUT_MS: 'TIMEOUT_MS',
} as const;
