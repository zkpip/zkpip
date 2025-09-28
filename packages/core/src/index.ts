// ESM-safe public barrel for @zkpip/core

// Manifest exports…
export { canonicalizeManifest } from './manifest/canonicalize.js';
export { computeManifestHash } from './manifest/hashing.js';
export { signManifest, verifyManifest } from './manifest/signing.js';
export { canonicalizeManifestToBytes } from './manifest/canonicalize.js';
export type { ZkpipManifest, ManifestSignature } from './manifest/types.js';

// AJV/schema utils – ezek a NÁLAD létező pathok:
export { createAjv } from './validation/ajv.js';
export { addCoreSchemas } from './validation/addCoreSchemas.js';
export { loadSchemaJson } from './schemaUtils.js';

export { c14nStringify } from './utils/json-c14n.js';
export type { SignVectorArgs, SealedVector } from './utils/seal/signVector.js';
export { signVector } from './utils/seal/signVector.js';

export * from './keys/keyId.js';
export * from './kind.js';