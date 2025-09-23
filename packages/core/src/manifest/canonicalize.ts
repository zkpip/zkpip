// Deterministic JSON canonicalization for manifests.
// Rules (M1/A):
// - UTF-8
// - Object keys sorted lexicographically (recursively)
// - Arrays keep order
// - No insignificant whitespace (use JSON.stringify) + ensure trailing LF
// - Canonicalization input EXCLUDES "signature" field

const EXCLUDE_FIELDS = new Set<string>(['hash', 'signature', 'signatures']);

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && Object.getPrototypeOf(v) === Object.prototype;
}

/**
 * Recursively remove excluded top-level fields (by name) from an object tree.
 * Arrays are preserved; objects are copied without excluded keys.
 */
function omitExcluded(value: unknown, exclude: ReadonlySet<string>): unknown {
  if (Array.isArray(value)) {
    return value.map((el) => omitExcluded(el, exclude));
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (exclude.has(k)) continue;
      out[k] = omitExcluded(v, exclude);
    }
    return out;
  }
  // primitive (string/number/boolean/null) or other (Date, etc.) → return as-is
  return value;
}

/**
 * Deep-sort object keys lexicographically to achieve deterministic JSON.
 * Arrays keep their order; only object keys are sorted.
 */
function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((el) => sortKeysDeep(el));
  }
  if (isPlainObject(value)) {
    const sortedKeys = Object.keys(value).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const out: Record<string, unknown> = {};
    for (const k of sortedKeys) {
      out[k] = sortKeysDeep((value as Record<string, unknown>)[k]!);
    }
    return out;
  }
  return value;
}

/**
 * Canonical JSON string for hashing/signing:
 * - removes {hash, signature, signatures}
 * - deep-sorts object keys
 * - pretty with 2 spaces
 * - ends with single LF
 */
export function canonicalizeManifest(manifest: unknown): string {
  const pruned = omitExcluded(manifest, EXCLUDE_FIELDS);
  const sorted = sortKeysDeep(pruned);
  return JSON.stringify(sorted, null, 2) + '\n';
}

/** Canonical UTF-8 bytes helper (preferred for hashing/signing). */
export function canonicalizeManifestToBytes(manifest: unknown): Uint8Array {
  const json = canonicalizeManifest(manifest);
  return new TextEncoder().encode(json);
}
