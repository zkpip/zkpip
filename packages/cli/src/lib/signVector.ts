// ESM-only, strict TS, no `any`.
// Local CLI copy to unblock build; later we can switch to @zkpip/core export.

import { createHash, sign as nodeSign } from 'node:crypto';

export type SignVectorArgs = Readonly<{
  vector: unknown;
  privateKeyPem: string;                 // PKCS#8 PEM
  kid: string;                           // logical key id (matches --keyId)
  alg?: 'ed25519';
  meta?: Record<string, string | number | boolean>;
}>;

export type SealedVector = Readonly<{
  envelopeId: string;
  vectorUrn: string;                     // urn:zkpip:vector:sha256:<hex>
  signature: string;                     // base64
  alg: 'ed25519';
  kid: string;
  createdAt: string;                     // ISO
  meta?: Record<string, string | number | boolean>;
}>;

function c14nStringify(value: unknown): string {
  return _c14n(value);
}
function _c14n(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map((it) => _c14n(it)).join(',')}]`;
  const obj = v as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const body = keys.map((k) => `${JSON.stringify(k)}:${_c14n(obj[k])}`).join(',');
  return `{${body}}`;
}

export function signVector(args: SignVectorArgs): SealedVector {
  const alg: 'ed25519' = args.alg ?? 'ed25519';
  if (alg !== 'ed25519') throw new Error('Only ed25519 is supported');

  const canon = c14nStringify(args.vector);
  const hash = createHash('sha256').update(canon, 'utf8').digest('hex');
  const vectorUrn = `urn:zkpip:vector:sha256:${hash}`;

  const sigBuf = nodeSign(null, Buffer.from(canon, 'utf8'), args.privateKeyPem);
  const signature = sigBuf.toString('base64');

  const createdAt = new Date().toISOString();
  const envelopeId = `env-${hash.slice(0, 16)}-${args.kid}`;

  return { envelopeId, vectorUrn, signature, alg, kid: args.kid, createdAt, ...(args.meta ? { meta: args.meta } : {}) };
}
