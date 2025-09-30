import type { Options, ErrorObject } from 'ajv';
import { createAjv } from '../validation/createAjv.js';
import sealSchema from '../../schemas/mvs/seal.schema.json' with { type: 'json' };

export type AjvErrorLite = Readonly<{
  path: string;
  keyword: string;
  message?: string;
}>;

type AjvErr = Readonly<{
  instancePath: string;
  keyword: string;
  message?: string;
  schemaPath?: string;
  params?: Readonly<Record<string, unknown>>;
}>;

export type ValidateSealV1Ajv =
  | { ok: true }
  | {
      ok: false;
      errors: ReturnType<typeof errorsToMinimal>;
      error: 'SCHEMA_VALIDATION_FAILED';
      message: string;
      rawErrors: readonly ErrorObject[];
    };

export type AjvResult =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; errors: readonly AjvErrorLite[]; error: string; message: string }>;

const defaultOptions: Options = { strict: true, allErrors: true };
const ajv = createAjv(defaultOptions);
const validate = ajv.compile(sealSchema);

export function errorsToMinimal(es: readonly AjvErr[]): readonly AjvErrorLite[] {
  return es.map((e) => ({
    path: e.instancePath || '/',
    keyword: e.keyword,
    ...(e.message ? { message: e.message } : {}),
  }));
}

export function validateSealV1Ajv(input: unknown): ValidateSealV1Ajv {
  const ok = validate(input);
  if (ok) return { ok: true as const };

  const rawErrors = (validate.errors ?? []) as readonly ErrorObject[];

  const rawLite = rawErrors.map((e) => ({
    instancePath: e.instancePath ?? '',
    keyword: e.keyword,
    message: e.message,
    schemaPath: e.schemaPath, // ok, Ajv ErrorObject-ben kötelező string; a te típusod optional, ez kompatibilis
    params: (e.params ?? {}) as Readonly<Record<string, unknown>>,
  }));

  const minimal = errorsToMinimal(rawLite);

  return {
    ok: false as const,
    errors: minimal,
    error: 'SCHEMA_VALIDATION_FAILED',
    message: 'Schema validation failed',
    rawErrors
  };
}
