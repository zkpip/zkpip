// ESM, strict TS, no "any"
// Canonical JSON (C14N) with lexicographically sorted object keys,
// stable array ordering, and SHA-256 helpers.
//
// Contract:
// - Object keys sorted lexicographically.
// - Arrays preserve order.
// - `undefined`, `function`, `symbol` are not allowed (throw on encounter).
// - JSON number/string/boolean encoding per JSON spec (via JSON.stringify).
// - Dates must be stringified by caller, if needed.
// - Cycles: throw Error("CYCLE_NOT_SUPPORTED").

import { createHash } from 'node:crypto';

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | { readonly [k: string]: JsonValue }
  | ReadonlyArray<JsonValue>;

/** Deterministic canonical stringify with sorted object keys. */
export function canonicalize(value: JsonValue): string {
  const seen = new WeakSet<object>();

  function walk(v: JsonValue): unknown {
    if (v === null) return null;
    const t = typeof v;
    if (t === 'string' || t === 'number' || t === 'boolean') return v;

    if (Array.isArray(v)) {
      // preserve array order; disallow holes / undefined / function / symbol entries
      const out: unknown[] = [];
      for (let i = 0; i < v.length; i++) {
        if (!Object.prototype.hasOwnProperty.call(v, i)) {
          throw new Error(`UNDEFINED_ARRAY_HOLE_AT_INDEX:${i}`);
        }
        const it = v[i];
        if (typeof it === 'undefined') {
          throw new Error(`UNDEFINED_ARRAY_ENTRY_AT_INDEX:${i}`);
        }
        const vt = typeof (it as unknown);
        if (vt === 'function' || vt === 'symbol') {
          throw new Error(`UNSUPPORTED_TYPE_AT_INDEX:${i}`);
        }
        out.push(walk(it));
      }
      return out;
    }

    // object
    const obj = v as Record<string, JsonValue>;
    if (seen.has(obj)) throw new Error('CYCLE_NOT_SUPPORTED');
    seen.add(obj);

    const out: Record<string, unknown> = {};
    const keys = Object.keys(obj).sort();
    for (const k of keys) {
      const val = obj[k];
      // JsonValue excludes undefined by type; if sneaks through, throw:
      if (typeof val === 'undefined') {
        throw new Error(`UNDEFINED_VALUE_AT_KEY:${k}`);
      }
      // Disallow functions and symbols explicitly for safety:
      const vt = typeof (val as unknown);
      if (vt === 'function' || vt === 'symbol') {
        throw new Error(`UNSUPPORTED_TYPE_AT_KEY:${k}`);
      }
      out[k] = walk(val);
    }
    return out;
  }

  return JSON.stringify(walk(value));
}

/** Alias for canonicalize (explicit naming for API symmetry). */
export const stableStringify = canonicalize;

/** Hex-encoded SHA-256 of input string (utf8). */
export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/** Build vector URN from hex digest. */
export function toVectorUrn(hex: string): `urn:zkpip:vector:sha256:${string}` {
  return `urn:zkpip:vector:sha256:${hex}`;
}
