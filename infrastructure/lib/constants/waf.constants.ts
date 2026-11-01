/**
 * Web Application Firewall (WAF) Configuration
 * 
 * Defines AWS managed rule sets and WAF configuration for WordPress protection.
 * 
 * Rule Sets:
 * - COMMON_RULE_SET: Protects against OWASP Top 10 vulnerabilities
 * - WORDPRESS_RULE_SET: WordPress-specific attack patterns (SQL injection, XSS in WP context)
 * 
 * Scope: REGIONAL for ALB (use CLOUDFRONT for CloudFront distributions)
 * 
 * Metric Names: Used for CloudWatch metrics and dashboards
 * Priorities: Lower numbers evaluated first
 */
export const WAF_CONSTANTS = {
  // WAF Scope
  SCOPE_REGIONAL: 'REGIONAL',
  
  // Rule Names
  RULE_AWS_COMMON: 'AWS-Common',
  RULE_AWS_WORDPRESS: 'AWS-WP',
  
  // Managed Rule Sets
  VENDOR_AWS: 'AWS',
  COMMON_RULE_SET: 'AWSManagedRulesCommonRuleSet',
  WORDPRESS_RULE_SET: 'AWSManagedRulesWordPressRuleSet',
  
  // Priorities
  COMMON_RULE_PRIORITY: 1,
  WORDPRESS_RULE_PRIORITY: 2,
  
  // Metric Names
  METRIC_WAF: 'WAF',
  METRIC_WAF_COMMON: 'WAFCommon',
  METRIC_WAF_WP: 'WAFWP',
} as const;
