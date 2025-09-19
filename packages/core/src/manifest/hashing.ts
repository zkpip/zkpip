import { createHash } from 'node:crypto';
import { canonicalizeManifestToBytes } from './canonicalize.js';

export interface ManifestHash {
  alg: 'sha256';
  value: string; // base64url without padding
}

function toBase64Url(buf: Uint8Array): string {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function computeManifestHash(manifest: unknown): ManifestHash {
  const bytes = canonicalizeManifestToBytes(manifest); // excludes hash/signature(s)
  const sha = createHash('sha256').update(bytes).digest(); // Buffer
  return { alg: 'sha256', value: toBase64Url(sha) };
}
