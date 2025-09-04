// packages/core/src/testing/ajv-helpers.ts
import type { ErrorObject } from 'ajv';

export interface AjvInstance {
  addSchema(schema: Record<string, unknown>, key?: string): unknown;
  getSchema(
    id: string,
  ): (((data: unknown) => boolean) & { errors?: ErrorObject[] | null }) | undefined;
  errorsText(
    errors?: ErrorObject[] | null,
    opts?: { separator?: string; dataVar?: string },
  ): string;
}

type ValidateFn = ((data: unknown) => boolean) & { errors?: ErrorObject[] | null };

export function validateAgainstResult(
  ajv: AjvInstance,
  schemaId: string,
  data: Record<string, unknown>,
): { ok: true; text: string } | { ok: false; text: string } {
  const validate = ajv.getSchema(schemaId) as ValidateFn | undefined;
  if (!validate) {
    return { ok: false, text: `Schema not registered: ${schemaId}` };
  }
  const ok = validate(data);
  if (ok) return { ok: true, text: 'OK' };

  const msg = ajv.errorsText(validate.errors ?? null, { separator: '\n' });
  return {
    ok: false,
    text: `Validation failed for schema ${schemaId}\n${msg}`,
  };
}
