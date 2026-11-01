/**
 * Network Configuration
 * 
 * Defines ports, paths, and network-related strings used throughout the infrastructure.
 * 
 * Ports:
 * - 80: HTTP traffic
 * - 443: HTTPS traffic
 * - 2049: NFS (EFS)
 * - 3306: MySQL (Aurora)
 * - 6379: Redis
 * 
 * Paths: WordPress-specific URL patterns for routing and health checks
 * Prefixes: S3 key prefixes for log organization
 */
export const NETWORK_CONSTANTS = {
  // Ports
  HTTP_PORT: 80,
  HTTPS_PORT: 443,
  NFS_PORT: 2049,
  MYSQL_PORT: 3306,
  REDIS_PORT: 6379,
  
  // WordPress Paths
  WP_ADMIN_PATH: '/wp-admin*',
  WP_LOGIN_PATH: '/wp-login.php*',
  // /wp-login.php requires PHP-FPM to be running and WordPress to bootstrap successfully,
  // unlike a static file which passes health checks even when PHP or the DB is broken.
  WP_HEALTH_CHECK_PATH: '/wp-login.php',
  WP_UPLOADS_PATH: 'wp-content/uploads/*',
  
  // S3 Prefixes
  ALB_LOGS_PREFIX: 'alb-logs/',
  
  // ARN Patterns
  SQS_QUEUE_PATTERN: 'wp-sync-*',
  
  // Geo Restrictions (ISO country codes)
  ALLOWED_COUNTRIES: ['IN', 'US', 'GB'] as const,
} as const;
