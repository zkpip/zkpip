// packages/core/src/validation/ajvSafeAdd.ts
import type { AjvRegistryLike } from './ajv-types.js';

/**
 * Add a JSON Schema object only once by its `$id` if present.
 * Boolean schemas are intentionally not supported here.
 */
export function addSchemaOnce(
  ajv: AjvRegistryLike,
  schema: object & { readonly $id?: string },
  keyIfNoId?: string,
): void {
  // TS-level guarantee: `schema` is object (no boolean).
  const id = (schema as { $id?: string }).$id;
  if (id) {
    if (ajv.getSchema(id)) return;     // already registered by $id
    ajv.addSchema(schema, id);
    return;
  }
  // No $id → use a stable key to avoid dupes (e.g., file path)
  if (keyIfNoId) {
    if (ajv.getSchema(keyIfNoId)) return;
    ajv.addSchema(schema, keyIfNoId);
  } else {
    // As a last resort, add without key (may duplicate if called twice)
    ajv.addSchema(schema);
  }
}
