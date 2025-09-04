// packages/core/src/index.ts
// Public barrel for @zkpip/core (force runtime emit: value imports + value exports)

// 1) VALUE IMPORTS (not type-only) → guarantees JS output
import { createAjv } from './validation/createAjv.js';
import { addCoreSchemas } from './validation/addCoreSchemas.js';
import { CANONICAL_IDS } from './constants/canonicalIds.js';
import { validateError, validateIssue, validateEcosystem } from './validation/validators.js';
// If you really need this and it exists:
import { loadSchemaJson } from './schemaUtils.js';

// 2) VALUE EXPORTS (re-exporting the value bindings)
export {
  createAjv,
  addCoreSchemas,
  CANONICAL_IDS,
  validateError,
  validateIssue,
  validateEcosystem,
  loadSchemaJson,
};
export type { AjvInstance } from './validation/createAjv.js';

// 3) Wildcard export kept (vectors contains values)
export * from './validate/vectors.js';

// 4) A small value to ensure index always emits
export const CORE_VERSION = '0.1.0';
