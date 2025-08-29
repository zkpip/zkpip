// packages/core/src/testing/ajv-helpers.ts
import type { ErrorObject } from "ajv";
import type { AjvInstance } from "../schemaUtils.js";

import type Ajv from "ajv";
type RealAjv = Ajv;

// Strukturális unió – mindkettőn van getSchema / errorsText / addSchema
type AjvLike = AjvInstance | RealAjv;

type ValidateFn = ((data: unknown) => boolean) & { errors?: ErrorObject[] | null };

export function validateAgainstResult(
  ajv: AjvLike,
  schemaId: string,
  data: Record<string, unknown>
): { ok: true; text: string } | { ok: false; text: string } {
  const validate = ajv.getSchema(schemaId) as ValidateFn | undefined;
  if (!validate) {
    return { ok: false, text: `Schema not registered: ${schemaId}` };
  }
  const ok = validate(data);
  if (ok) return { ok: true, text: "OK" };

  const msg = ajv.errorsText(validate.errors ?? null, { separator: "\n" });
  return {
    ok: false,
    text: `Validation failed for schema ${schemaId}\n${msg}`,
  };
}
