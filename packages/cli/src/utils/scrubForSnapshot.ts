// ESM, strict TS. Removes non-deterministic fields for snapshot comparisons.
type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

const NON_DETERMINISTIC_KEYS = new Set([
  'envelopeId',        // re-computed elsewhere
  'timestamp',
  'createdAt',
  'updatedAt',
  'nonce',
]);

export function scrubForSnapshot<T extends Json>(input: T): T {
  return scrub(input) as T;
}

function scrub(node: Json): Json {
  if (node === null) return null;
  if (typeof node !== 'object') return node;

  if (Array.isArray(node)) return node.map(scrub) as Json;

  const out: { [k: string]: Json } = {};
  for (const [k, v] of Object.entries(node)) {
    if (NON_DETERMINISTIC_KEYS.has(k)) continue;
    out[k] = scrub(v as Json);
  }
  return out;
}
