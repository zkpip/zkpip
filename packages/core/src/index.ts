// ESM-safe public barrel for @zkpip/core
// Re-export only from aggregated sub-barrels to keep runtime imports stable.
export * from './validation/index.js';
export * from './constants/index.js';
export * from './utils/index.js';

// Manifest exports…
export * from './manifest/types.js';
export { canonicalizeManifest } from './manifest/canonicalize.js';
export { computeManifestHash } from './manifest/hashing.js';
export { signManifest, verifyManifest } from './manifest/signing.js';

// AJV/schema utils – ezek a NÁLAD létező pathok:
export { createAjv } from './validation/ajv.js';
export { addCoreSchemas } from './validation/addCoreSchemas.js';
export { loadSchemaJson } from './schemaUtils.js';