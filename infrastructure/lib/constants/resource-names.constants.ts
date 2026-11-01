/**
 * CDK Resource Identifiers for Static WordPress Stack
 *
 * Defines the logical IDs for all CDK resources in the static architecture.
 */
export const RESOURCE_NAMES = {
  // Storage & Public Static Site
  PUBLIC_STATIC_BUCKET: 'WP-Public-Static',
  LOGS_BUCKET: 'WP-Logs',
  BACKUP_BUCKET: 'WP-Backup',
  KMS_KEY: 'WP-KMS',
  CLOUDFRONT_OAC: 'WP-OAC',
  CLOUDFRONT_DISTRIBUTION: 'WP-Public-CDN',
  DOMAIN_REDIRECT_FUNCTION: 'WP-Domain-Redirect-Fn',

  // Network & Admin Security (Zero Open Inbound Ports)
  VPC: 'WP-Admin-VPC',
  VPC_FLOW_LOG: 'VPCFlow',
  S3_GATEWAY: 'S3Gate',
  ADMIN_SG: 'WP-Admin-SG',

  // Admin Server & IAM
  ADMIN_INSTANCE: 'WP-Admin-Server',
  ADMIN_ROLE: 'WP-Admin-Role',

  // Monitoring & Governance
  ALERT_TOPIC: 'Alerts',
  BUDGET: 'Budget',
  CF_5XX_ALARM: 'CF-5xx-Alarm',
} as const;
