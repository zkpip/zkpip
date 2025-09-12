// Canonical JSON type for strict TypeScript codebases.
// - Readonly objects/arrays to discourage mutation
// - No `any`
// - Safe to import as: `import type { Json } from '../types/json.js';`

export type JsonPrimitive = string | number | boolean | null;

export type JsonObject = {
  readonly [key: string]: Json;
};

export type JsonArray = readonly Json[];

export type Json = JsonPrimitive | JsonObject | JsonArray;

// Optional narrow helpers (kept type-only here to avoid runtime emission)
// export type { JsonPrimitive as JsonValue, JsonObject as JSONObject, JsonArray as JSONArray };
