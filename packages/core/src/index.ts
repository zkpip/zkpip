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
export { validateSealV1Ajv } from './schema/validateSeal.js';

export type { VerifySealResult, Options, VerifyStage } from './verify/verifySealV1.js';
export { VerifyCode, type VerifyReason, type VerifyResult } from './verify/codes.js';
export { verifySealV1 } from './verify/verifySealV1.js';

export * from './keys/keyId.js';
export * from './kind.js';
export * from './seal/v1.js';

export { verifySealV1 as default } from './verify/verifySealV1.js';
export { AjvRegistryLike } from './validation/ajv-types.js';

export { PublicKeyProvider } from './verify/types.js';

export { VerifySealOptions } from './verify/types.js';