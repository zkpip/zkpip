// Sign a canonicalized vector JSON with an Ed25519 private key (PKCS#8 PEM).
// Output includes: envelopeId, vectorUrn, signature, alg, kid, createdAt, optional meta.

import { createHash, sign as nodeSign } from 'node:crypto';
import { c14nStringify } from '../../utils/json-c14n.js';

export type SignVectorArgs = Readonly<{
  vector: unknown;                       // raw JSON object to seal
  privateKeyPem: string;                 // PKCS#8 PEM
  kid: string;                           // logical key id (matches CLI --keyId)
  alg?: 'ed25519';
  meta?: Record<string, string | number | boolean>;
}>;

export type SealedVector = Readonly<{
  envelopeId: string;                    // e.g. "env-<hash16>-<kid>"
  vectorUrn: string;                     // urn:zkpip:vector:sha256:<hex>
  signature: string;                     // base64
  alg: 'ed25519';
  kid: string;
  createdAt: string;                     // ISO timestamp
  meta?: Record<string, string | number | boolean>;
}>;

export function signVector(args: SignVectorArgs): SealedVector {
  const alg: 'ed25519' = args.alg ?? 'ed25519';
  if (alg !== 'ed25519') throw new Error('Only ed25519 is supported');

  // 1) Canonicalize JSON
  const canon = c14nStringify(args.vector);

  // 2) Hash → URN
  const hash = createHash('sha256').update(canon, 'utf8').digest('hex');
  const vectorUrn = `urn:zkpip:vector:sha256:${hash}`;

  // 3) Ed25519 sign (message = canonical JSON bytes)
  const sigBuf = nodeSign(null, Buffer.from(canon, 'utf8'), args.privateKeyPem);
  const signature = sigBuf.toString('base64');

  // 4) Envelope ID + timestamp
  const createdAt = new Date().toISOString();
  const envelopeId = `env-${hash.slice(0, 16)}-${args.kid}`;

  return {
    envelopeId,
    vectorUrn,
    signature,
    alg,
    kid: args.kid,
    createdAt,
    ...(args.meta ? { meta: args.meta } : {}),
  };
}
