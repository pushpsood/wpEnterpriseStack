/**
 * Database Configuration
 * 
 * Defines database engine identifiers and cluster configuration strings.
 * 
 * Engine: aurora-mysql (compatible with WordPress)
 * Version: 8.0.mysql_aurora.3.05.2 (Aurora MySQL 3.x with MySQL 8.0 compatibility)
 * 
 * Global Cluster: Enables cross-region replication for disaster recovery
 * 
 * Variations:
 * - Use 'aurora-postgresql' for PostgreSQL workloads
 * - Update version string when upgrading Aurora engine
 */
export const DATABASE_CONSTANTS = {
  // Engine Configuration
  ENGINE_AURORA_MYSQL: 'aurora-mysql',
  ENGINE_VERSION: '8.0.mysql_aurora.3.05.2',
  
  // Global Cluster
  GLOBAL_CLUSTER_ID: 'wp-global-cluster',
  
  // Redis Configuration
  ENGINE_REDIS: 'redis',
  REDIS_NUM_CLUSTERS: 2,
  
  // Subnet Group
  REDIS_SUBNET_DESCRIPTION: 'RSN',
  
  // Replication
  REDIS_REPLICATION_DESCRIPTION: 'WP Cache',
} as const;
