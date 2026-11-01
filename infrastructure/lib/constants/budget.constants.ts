/**
 * AWS Budgets Configuration
 * 
 * Defines budget notification settings and thresholds.
 * 
 * Budget Type: COST (tracks actual spending vs forecast)
 * Time Unit: MONTHLY (resets each calendar month)
 * Currency: USD (all amounts in US Dollars)
 * 
 * Notification:
 * - Threshold: 80% (triggers when 80% of budget is consumed)
 * - Type: ACTUAL (based on actual spend, not forecasted)
 * - Comparison: GREATER_THAN (triggers when exceeding threshold)
 * 
 * Variations:
 * - Use FORECASTED for predictive alerts
 * - Add multiple thresholds (50%, 80%, 100%)
 */
export const BUDGET_CONSTANTS = {
  // Budget Configuration
  BUDGET_NAME: 'WP-Cost',
  BUDGET_TYPE: 'COST',
  TIME_UNIT: 'MONTHLY',
  CURRENCY_UNIT: 'USD',
  
  // Notification Settings
  COMPARISON_OPERATOR: 'GREATER_THAN',
  NOTIFICATION_TYPE: 'ACTUAL',
  THRESHOLD_PERCENTAGE: 80,
  THRESHOLD_TYPE: 'PERCENTAGE',
  
  // Subscription
  SUBSCRIPTION_TYPE: 'EMAIL',
} as const;
