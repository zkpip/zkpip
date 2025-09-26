// Deterministic JSON canonicalizer (c14n) with stable key ordering.
// - No whitespace, UTF-8 assumed by caller.
// - Arrays keep order; objects have lexicographically sorted keys.
// - Supports primitives, arrays, and plain objects.

export function c14nStringify(value: unknown): string {
  return _c14n(value);
}

function _c14n(v: unknown): string {
  if (v === null || typeof v !== 'object') {
    return JSON.stringify(v);
  }
  if (Array.isArray(v)) {
    const items = v.map((it) => _c14n(it)).join(',');
    return `[${items}]`;
  }
  const obj = v as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const body = keys.map((k) => `${JSON.stringify(k)}:${_c14n(obj[k])}`).join(',');
  return `{${body}}`;
}
