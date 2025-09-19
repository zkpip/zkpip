// Deterministic JSON canonicalization for manifests.
// Rules (M1/A):
// - UTF-8
// - Object keys sorted lexicographically (recursively)
// - Arrays keep order
// - No insignificant whitespace (use JSON.stringify) + ensure trailing LF
// - Canonicalization input EXCLUDES "signature" field

import { ZkpipManifest } from './types.js';

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export interface CanonicalizeOptions {
  dropFields?: ReadonlyArray<string>;
}

function sortObject(obj: Record<string, unknown>, drop: Set<string>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const keys = Object.keys(obj).sort();
  for (const k of keys) {
    if (drop.has(k)) continue;                // <-- drop fields like 'signature', 'hash'
    const val = obj[k];
    if (Array.isArray(val)) {
      result[k] = val.map((x) => (isPlainObject(x) ? sortObject(x as Record<string, unknown>, drop) : x));
    } else if (isPlainObject(val)) {
      result[k] = sortObject(val as Record<string, unknown>, drop);
    } else {
      result[k] = val;
    }
  }
  return result;
}

export function canonicalizeManifest(manifest: ZkpipManifest, opts?: CanonicalizeOptions): string {
  const drop = new Set<string>(opts?.dropFields ?? []);
  const sorted = sortObject(manifest as Record<string, unknown>, drop);
  const json = JSON.stringify(sorted);
  return json.endsWith('\n') ? json : `${json}\n`;
}

export function canonicalizeManifestForHash(manifest: ZkpipManifest): string {
  return canonicalizeManifest(manifest, { dropFields: ['signature', 'hash'] });
}
