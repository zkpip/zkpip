// packages/cli/src/utils/normalizeJsonStable.ts
// ESM, strict TS, no "any" — stable key ordering normalizer.
export type JsonPrimitive = string | number | boolean | null;
export type Json = JsonPrimitive | JsonObject | JsonArray;
export type JsonArray = ReadonlyArray<Json>;
export type JsonObject = { readonly [k: string]: Json };

export function normalizeJsonStable(input: unknown): Json {
  return orderKeys(asJson(input));
}

function asJson(x: unknown): Json {
  if (x === null || typeof x === 'string' || typeof x === 'number' || typeof x === 'boolean') return x;
  if (Array.isArray(x)) return x.map(asJson) as JsonArray;
  if (typeof x === 'object') {
    const out: Record<string, Json> = {};
    for (const [k, v] of Object.entries(x as Record<string, unknown>)) {
      out[k] = asJson(v);
    }
    return out as JsonObject;
  }
  // Non-JSON types are stringified for robustness
  return String(x);
}

function orderKeys(node: Json): Json {
  if (node === null || typeof node !== 'object') return node;
  if (Array.isArray(node)) return node.map(orderKeys) as JsonArray;
  const obj = node as JsonObject;
  const out: Record<string, Json> = {};
  for (const k of Object.keys(obj).sort()) {
    out[k] = orderKeys(obj[k]!);
  }
  return out as JsonObject;
}
