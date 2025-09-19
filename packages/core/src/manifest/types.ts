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
  signedAt?: string;     // ISO
}

export interface ZkpipManifest {
  hash?: { alg: 'sha256'; value: string }
  signature?: ManifestSignature;        // single
  signatures?: ReadonlyArray<ManifestSignature>; // multi
}