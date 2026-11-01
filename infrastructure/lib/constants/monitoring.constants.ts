/**
 * Monitoring and Alerting Configuration
 * 
 * Defines thresholds, evaluation periods, and metric names for CloudWatch alarms.
 * 
 * Thresholds:
 * - DLQ_THRESHOLD: Triggers when dead letter queue has messages (indicates Lambda failures)
 * - ALB_5XX_THRESHOLD: Triggers on sustained 5xx errors (backend issues)
 * 
 * Evaluation Periods: Number of consecutive periods threshold must be breached
 * 
 * Variations: Adjust thresholds based on traffic patterns and SLA requirements
 */
export const MONITORING_CONSTANTS = {
  // Alarm Thresholds
  DLQ_THRESHOLD: 1,
  ALB_5XX_THRESHOLD: 10,
  
  // Evaluation Periods
  DLQ_EVALUATION_PERIODS: 1,
  ALB_5XX_EVALUATION_PERIODS: 2,
} as const;
