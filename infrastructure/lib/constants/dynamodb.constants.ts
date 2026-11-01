/**
 * DynamoDB Configuration
 * 
 * Defines table schema and index configuration for state management.
 * 
 * Partition Key (pk): Primary identifier for items
 * Sort Key (sk): Secondary identifier for range queries
 * 
 * Global Secondary Index:
 * - UpdateIdIndex: Allows querying by update ID (sk becomes partition key)
 * - Projection: ALL (includes all attributes in index)
 * 
 * Usage: State table tracks WordPress sync operations across worker fleet
 * 
 * Variations: Add more GSIs for different query patterns
 */
export const DYNAMODB_CONSTANTS = {
  // Table Keys
  PARTITION_KEY: 'pk',
  SORT_KEY: 'sk',
  
  // Global Secondary Index
  GSI_UPDATE_ID: 'UpdateIdIndex',
} as const;
