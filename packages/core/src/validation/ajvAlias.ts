// packages/core/src/validation/ajvAlias.ts
import type { AjvRegistryLike } from './ajv-types.js';

export function addSchemaAliases(
  ajv: AjvRegistryLike,
  targetId: string,
  aliases: readonly string[],
): void {
  for (const a of aliases) {
    if (a === targetId) continue;      // avoid self-alias
    if (ajv.getSchema(a)) continue;
    // $ref-wrapper → nem ugyanazt az objektumot adjuk újra
    ajv.addSchema({ $ref: targetId } as object, a);
  }
}