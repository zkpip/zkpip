export type JSONPrimitive = string | number | boolean | null;
export type JsonObject = { readonly [k: string]: JsonValue };
export type JsonArray = readonly JsonValue[];
export type JsonValue = JSONPrimitive | JsonObject | JsonArray;