// ESM-only, strict TS, no `any`.
// Generates an Ed25519 keypair and returns PEM + metadata.

import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { KeyMeta, KeypairMaterial } from './types.js';

export type GenerateKeysArgs = Readonly<{
  alg?: 'ed25519';      // default: 'ed25519'
  label?: string;       // optional human-readable label
}>;

export function generateKeys(args: GenerateKeysArgs = {}): KeypairMaterial {
  // Currently only ed25519 is supported; keep switch for future algs.
  const alg: 'ed25519' = args.alg ?? 'ed25519';

  // Generate keypair in PEM (PKCS#8 private, SPKI public)
  const { privateKey, publicKey } = generateKeyPairSync(alg, {
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding:  { type: 'spki',  format: 'pem' },
  });

  // Create deterministic-enough, URL-safe KID (uuid + short suffix)
  const createdAt = new Date().toISOString();
  const kid = `kid-${randomUUID()}`;

  const meta: KeyMeta = {
    kid,
    alg,
    createdAt,
    ...(args.label ? { label: args.label } : {}),
  };

  const material: KeypairMaterial = {
    privateKeyPem: privateKey,
    publicKeyPem: publicKey,
    meta,
  };

  return material;
}
