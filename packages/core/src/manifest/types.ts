// ESM-only, strict TS. No "any".

export type BaseAlg = 'sha256';
export type SigAlg = 'Ed25519' | 'secp256k1'; // future-proof, we start with Ed25519

export interface ManifestHash {
  alg: BaseAlg;          // e.g. "sha256"
  value: string;         // base64url-encoded digest of canonical payload (without signature)
}

export interface ManifestSignature {
  alg: SigAlg;           // "Ed25519" (primary in M1/A)
  keyId: string;         // developer-provided stable key identifier
  sig: string;           // base64url-encoded signature over the digest
}

export interface ZkpipManifest {
  // ... your existing manifest fields ...
  // IMPORTANT: signature must be optional in the "to-be-signed" payload.
  hash?: ManifestHash;
  signature?: ManifestSignature;
}
