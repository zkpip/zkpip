import { createHash } from 'node:crypto';
import { canonicalizeManifest } from './canonicalize.js';
import type { ZkpipManifest, ManifestHash } from './types.js';

function toBase64Url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function computeManifestHash(manifest: ZkpipManifest): ManifestHash {
  const canonical = canonicalizeManifest(manifest);
  const digest = createHash('sha256').update(canonical, 'utf8').digest();
  return { alg: 'sha256', value: toBase64Url(digest) };
}
