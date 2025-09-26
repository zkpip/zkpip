// ESM-only, strict TS, no `any`.

// Immutable metadata for a keypair
export type KeyMeta = Readonly<{
  kid: string;            // key identifier (URL-safe, time-based)
  alg: 'ed25519';         // supported algorithm(s)
  createdAt: string;      // ISO timestamp
  label?: string;         // optional human label
}>;

// Result returned by key generation
export type KeypairMaterial = Readonly<{
  privateKeyPem: string;  // PKCS#8 PEM
  publicKeyPem: string;   // SPKI PEM
  meta: KeyMeta;
}>;
