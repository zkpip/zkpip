// scripts/spec/jcs.ts
// JCS + base64url helpers used by make-manifests, sign-manifests, validate-specs
// All comments in English. No "any". ESM-ready.
import fs from 'node:fs/promises';
import { TextEncoder } from 'node:util';

export type Json =
  | string
  | number
  | boolean
  | null
  | { readonly [k: string]: Json | undefined }
  | readonly Json[];

/**
 * Canonical JSON per RFC8785-like strategy:
 * - Object keys sorted lexicographically (codepoint order)
 * - No insignificant whitespace
 * - Numbers serialized via JSON.stringify (assumes inputs already normalized)
 * - UTF-8 bytes returned for signing/verifying
 */
export function jcsCanonicalize(input: Json): Uint8Array {
  const enc = new TextEncoder();
  const s = canonicalStringify(input);
  return enc.encode(s);
}

/** Deterministic stringify that sorts object keys; arrays keep order. */
export function canonicalStringify(value: Json): string {
  if (value === null) return 'null';
  const t = typeof value;
  if (t === 'number' || t === 'boolean') return JSON.stringify(value);
  if (t === 'string') return JSON.stringify(value);

  if (Array.isArray(value)) {
    const parts: string[] = [];
    for (const v of value) parts.push(canonicalStringify(v as Json));
    return `[${parts.join(',')}]`;
  }

  // Object
  const obj = value as { readonly [k: string]: Json | undefined };
  const keys = Object.keys(obj).sort(); // codepoint order
  const parts: string[] = [];
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'undefined') continue; // drop undefined as JSON does
    parts.push(`${JSON.stringify(k)}:${canonicalStringify(v as Json)}`);
  }
  return `{${parts.join(',')}}`;
}

/** Base64url encode bytes (RFC 4648 §5). */
export function b64uFromBytes(bytes: Uint8Array): string {
  // Buffer is OK in Node, output is stable across Node versions
  return Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

/** Base64url → bytes (version-proof; don't rely on Buffer.from(...,'base64url')). */
export function b64uToBytes(s: string): Uint8Array {
  let t = s.trim().replace(/-/g, '+').replace(/_/g, '/');
  const pad = t.length % 4;
  if (pad) t += '='.repeat(4 - pad);
  return new Uint8Array(Buffer.from(t, 'base64'));
}

export async function loadJson<T = unknown>(p: string): Promise<T> {
  const raw = await fs.readFile(p, 'utf8');
  return JSON.parse(raw) as T;
}

export function assertJson(x: unknown, ctx: string): asserts x is Json {
  if (!isJson(x)) throw new Error(`${ctx} is not canonicalizable Json`);
}

export function isJson(x: unknown): x is Json {
  if (x === null) return true;
  const t = typeof x;
  if (t === 'string' || t === 'number' || t === 'boolean') return true;
  if (Array.isArray(x)) return x.every(isJson);
  if (t === 'object') return Object.values(x as Record<string, unknown>).every(isJson);
  return false;
}
