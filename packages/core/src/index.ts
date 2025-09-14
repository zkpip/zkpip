// ESM-safe public barrel for @zkpip/core
// Re-export only from aggregated sub-barrels to keep runtime imports stable.
export * from './validation/index.js';
export * from './constants/index.js';
export * from './utils/index.js';

/*
// Public API barrel for @zkpip/core (NodeNext ESM)
// English comments, no `any`.

// Validation API via a single stable path
export {
  createAjv,
  addCoreSchemas,
  validateError,
  validateIssue,
  validateEcosystem,
} from './validation/index.js';

// Constants / utilities
export { CANONICAL_IDS } from './constants/index.js';
export { loadSchemaJson } from './schemaUtils.js';

// Types (re-export as alias to keep external API stable)
export type { AjvLike as AjvInstance } from './validation/ajv-types.js';

// Keep vectors wildcard if it contains value exports
export * from './validate/vectors.js';

// Small value to ensure the barrel always emits
export const CORE_VERSION = '0.1.0';
*/
