// packages/core/src/testing/ajv-helpers.ts
import type { ErrorObject } from 'ajv';

import type { AjvLike } from '../validation/ajv-types.js';
export type AjvInstance = AjvLike;

type ValidateFn = ((data: unknown) => boolean) & { errors?: ErrorObject[] | null };

function formatAjvErrors(errors?: ErrorObject[] | null): string {
  if (!errors?.length) return '(no AJV errors)';
  return errors
    .map(e => {
      const path = e.instancePath || '/';
      const msg = e.message ?? 'validation error';
      const params =
        e.params && Object.keys(e.params).length ? ` ${JSON.stringify(e.params)}` : '';
      return `${path} ${msg}${params}`;
    })
    .join('\n');
}

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

  const msg = formatAjvErrors(validate.errors ?? ajv.errors);
  return {
    ok: false,
    text: `Validation failed for schema ${schemaId}\n${msg}`,
  };
}
