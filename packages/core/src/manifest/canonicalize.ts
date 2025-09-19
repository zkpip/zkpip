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

function sortObject(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const keys = Object.keys(obj).sort();
  for (const k of keys) {
    // Drop "signature" on canonicalization input
    if (k === 'signature') continue;
    const val = obj[k];
    if (Array.isArray(val)) {
      result[k] = val.map((x) => (isPlainObject(x) ? sortObject(x as Record<string, unknown>) : x));
    } else if (isPlainObject(val)) {
      result[k] = sortObject(val as Record<string, unknown>);
    } else {
      result[k] = val;
    }
  }
  return result;
}

export function canonicalizeManifest(manifest: ZkpipManifest): string {
  const sorted = sortObject(manifest as Record<string, unknown>);
  const json = JSON.stringify(sorted);
  // Ensure single LF at end for cross-platform stability
  return json.endsWith('\n') ? json : `${json}\n`;
}
