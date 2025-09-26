// packages/cli/src/utils/canonical.ts
import { createHash } from 'node:crypto';

export type JsonPrimitive = string | number | boolean | null;
export type Json = JsonPrimitive | JsonObject | JsonArray;
export type JsonArray = ReadonlyArray<Json>;
export type JsonObject = { readonly [k: string]: Json };

export function stableStringify(input: Json): string {
  return JSON.stringify(orderKeys(input));
}

function orderKeys(node: Json): Json {
  if (node === null || typeof node !== 'object') return node;
  if (Array.isArray(node)) return node.map(orderKeys) as Json;
  const obj = node as JsonObject;
  const out: JsonObject = {};
  for (const k of Object.keys(obj).sort()) {
    const v = obj[k]!; // safe: key from Object.keys
    (out as Record<string, Json>)[k] = orderKeys(v);
  }
  return out;
}

export function sha256HexCanonical(input: Json): string {
  const h = createHash('sha256').update(stableStringify(input)).digest('hex');
  return h;
}

export function toVectorUrn(hex: string): string {
  return `urn:zkpip:vector:sha256:${hex}`;
}

/** Runtime type-guard for Json (acyclic structures assumed). */
export function isJson(x: unknown): x is Json {
  if (x === null) return true;
  const t = typeof x;
  if (t === 'string' || t === 'number' || t === 'boolean') return true;
  if (Array.isArray(x)) return x.every(isJson);
  if (t === 'object') {
    for (const v of Object.values(x as Record<string, unknown>)) {
      if (!isJson(v)) return false;
    }
    return true;
  }
  return false;
}
