// ESM, strict TS, no "any".
// Minimal RFC8785-style JCS: code point key ordering; JSON.stringify for strings; finite numbers only.
import fs from 'node:fs/promises';

export type Json =
  | null
  | boolean
  | number
  | string
  | readonly Json[]
  | { readonly [k: string]: Json };

export function isJson(x: unknown): x is Json {
  if (x === null) return true;
  const t = typeof x;
  if (t === 'string' || t === 'number' || t === 'boolean') return true;
  if (Array.isArray(x)) return x.every(isJson);
  if (t === 'object') return Object.values(x as Record<string, unknown>).every(isJson);
  return false;
}

export async function loadJson<T = unknown>(p: string): Promise<T> {
  const raw = await fs.readFile(p, 'utf8');
  return JSON.parse(raw) as T;
}

export function assertJson(x: unknown, ctx: string): asserts x is Json {
  if (!isJson(x)) throw new Error(`${ctx} is not canonicalizable Json`);
}

export function jcsCanonicalize(value: Json): string {
  return serialize(value);
}

function serialize(v: Json): string {
  if (v === null) return 'null';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) {
      throw new Error('Non-finite number in JSON (JCS forbids NaN/±Infinity)');
    }
    // JSON.stringify number output már stabil & minimális
    return String(v);
  }
  if (typeof v === 'string') {
    return JSON.stringify(v);
  }
  if (Array.isArray(v)) {
    return `[${v.map(serialize).join(',')}]`;
  }
  // Object: code-point ordering (locale-agnosztikus)
  const obj = v as { readonly [k: string]: Json };
  const keys = Object.keys(obj).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const parts: string[] = [];
  for (const k of keys) {
    parts.push(`${JSON.stringify(k)}:${serialize(obj[k])}`);
  }
  return `{${parts.join(',')}}`;
}
