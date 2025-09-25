// JSON subset matcher compatible with the VerifyJson contract (no `any`)
// Local JSON types (keep in sync with src/contracts if needed)
export type JSONPrimitive = string | number | boolean | null;
export type JSONValue = JSONPrimitive | JSONObject | JSONArray;
export type JSONArray = ReadonlyArray<JSONValue>;
export interface JSONObject { readonly [k: string]: JSONValue }

export function isSubset(expected: JSONValue, actual: JSONValue): boolean {
  if (expected === actual) return true;

  // Primitive branch
  const expPrim = expected === null || typeof expected !== 'object';
  const actPrim = actual === null || typeof actual !== 'object';
  if (expPrim || actPrim) return expected === actual;

  // Arrays
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) return false;
    if (expected.length > actual.length) return false;
    for (let i = 0; i < expected.length; i++) {
      if (!isSubset(expected[i] as JSONValue, actual[i] as JSONValue)) return false;
    }
    return true;
  }

  // Objects
  const eObj = expected as JSONObject;
  const aObj = actual as JSONObject;
  for (const key of Object.keys(eObj)) {
    if (!(key in aObj)) return false;
    if (!isSubset(eObj[key] as JSONValue, aObj[key] as JSONValue)) return false;
  }
  return true;
}
