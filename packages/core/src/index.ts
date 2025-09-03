// Validation
export { validateError, validateIssue, validateEcosystem } from "./validation/validators.js";
export { createAjv } from "./validation/ajv.js";
export { addCoreSchemas, type CanonicalId } from "./validation/addCoreSchemas.js";

// Schema utilities
export { loadSchemaJson } from "./schemaUtils.js";

// Vector validation helpers
export * from "./validate/vectors.js";

export { CANONICAL_IDS } from "./constants/canonicalIds.js";

// Core metadata
export const CORE_VERSION = "0.1.0";
