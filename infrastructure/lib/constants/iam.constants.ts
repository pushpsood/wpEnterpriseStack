/**
 * IAM Policies and Actions
 * 
 * Defines AWS managed policies and IAM action strings for least-privilege access.
 * 
 * Managed Policies: Pre-built AWS policies attached to roles
 * Actions: Granular permissions for custom policy statements
 * 
 * Usage: Reference these constants instead of hardcoding policy names
 * Security: Ensures consistent permission boundaries across resources
 */
export const IAM_CONSTANTS = {
  // AWS Managed Policies
  SSM_MANAGED_INSTANCE_CORE: 'AmazonSSMManagedInstanceCore',
  DATASYNC_FULL_ACCESS: 'service-role/AWSDataSyncFullAccess',
  
  // SQS Actions
  SQS_CREATE_QUEUE: 'sqs:CreateQueue',
  SQS_DELETE_QUEUE: 'sqs:DeleteQueue',
  SQS_SEND_MESSAGE: 'sqs:SendMessage',
  SQS_RECEIVE_MESSAGE: 'sqs:ReceiveMessage',
  SQS_DELETE_MESSAGE: 'sqs:DeleteMessage',
  SQS_GET_QUEUE_ATTRIBUTES: 'sqs:GetQueueAttributes',
  SQS_SET_QUEUE_ATTRIBUTES: 'sqs:SetQueueAttributes',
  SQS_LIST_QUEUES: 'sqs:ListQueues',

  // SNS Actions
  SNS_PUBLISH: 'sns:Publish',
  SNS_SUBSCRIBE: 'sns:Subscribe',

  // Auto Scaling Actions
  AUTOSCALING_DESCRIBE_GROUPS: 'autoscaling:DescribeAutoScalingGroups',

  // DynamoDB Actions
  DYNAMODB_GET_ITEM: 'dynamodb:GetItem',
  DYNAMODB_PUT_ITEM: 'dynamodb:PutItem',
  DYNAMODB_UPDATE_ITEM: 'dynamodb:UpdateItem',
  DYNAMODB_QUERY: 'dynamodb:Query',
  DYNAMODB_SCAN: 'dynamodb:Scan',
  DYNAMODB_DELETE_ITEM: 'dynamodb:DeleteItem',
  
  // Service Principals
  DATASYNC_SERVICE_PRINCIPAL: 'datasync.amazonaws.com',
} as const;
