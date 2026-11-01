/**
 * Compute Configuration
 * 
 * Defines Auto Scaling Group and instance configuration values.
 * 
 * Instance Refresh Strategy:
 * - rolling: Gradually replaces instances to maintain availability
 * 
 * Capacity:
 * - Admin: Fixed 1 instance (handles wp-admin traffic)
 * - Worker: Scales 2-10 based on load (handles frontend traffic)
 * 
 * Variations:
 * - Use 'blue-green' strategy for zero-downtime deployments
 * - Adjust min/max based on traffic patterns
 */
export const COMPUTE_CONSTANTS = {
  // Auto Scaling
  INSTANCE_REFRESH_STRATEGY: 'rolling',
  
  // Admin ASG Capacity
  ADMIN_MIN_CAPACITY: 1,
  ADMIN_MAX_CAPACITY: 1,
} as const;
