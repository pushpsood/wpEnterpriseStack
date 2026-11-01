/**
 * Resource Tagging Configuration
 * 
 * Defines standard tags applied to all resources in the stack.
 * 
 * Tags are used for:
 * - Cost allocation and tracking
 * - Resource organization and filtering
 * - Compliance and governance
 * - Automation and lifecycle management
 * 
 * Best Practices:
 * - Use consistent tag keys across all resources
 * - Include environment, project, and owner tags
 * - Avoid PII in tag values
 * 
 * Variations: Add Environment, Owner, CostCenter tags as needed
 */
export const TAGS_CONSTANTS = {
  PROJECT_KEY: 'Project',
  PROJECT_VALUE: 'UltimateWordPressStateless',
} as const;
