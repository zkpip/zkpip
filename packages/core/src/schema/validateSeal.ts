// packages/core/src/schema/validateSeal.ts
// Reuse shared AJV factory and import JSON via "with { type: 'json' }"
import type { ErrorObject, ValidateFunction } from 'ajv';
import { createAjv } from '../validation/ajv.js';
import sealSchema from '../../schemas/mvs/seal.schema.json' with { type: 'json' };

export type SchemaError = Readonly<{
  instancePath: string;
  message: string;
}>;

export type SchemaValidateResult =
  | { ok: true }
  | { ok: false; errors: ReadonlyArray<SchemaError> };

// Cache the compiled validator to avoid recompilation
let _validator: ValidateFunction | null = null;

function getValidator(): ValidateFunction {
  if (_validator) return _validator;
  const ajv = createAjv();
  // Ajv expects a plain JSON schema object
  _validator = ajv.compile(sealSchema as unknown as object);
  return _validator;
}

export function validateSealJson(json: unknown): SchemaValidateResult {
  const validate = getValidator(); // ValidateFunction
  const ok = validate(json);
  if (ok) return { ok: true };

  const errors = (validate.errors ?? []).map((e: ErrorObject) => ({
    instancePath: e.instancePath,
    message: e.message ?? 'validation error',
  })) as ReadonlyArray<SchemaError>;

  return { ok: false, errors };
}
