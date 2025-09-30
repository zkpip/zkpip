// packages/core/src/validation/createAjv.ts
import type { Options } from 'ajv';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

type AjvCtor = new (opts?: Options) => import('ajv').default;
const Ajv2020Impl: AjvCtor = (
  (require('ajv/dist/2020') as { default?: AjvCtor }).default ??
  (require('ajv/dist/2020') as unknown as AjvCtor)
);

const addFormats: (ajv: import('ajv').default) => void = (
  (require('ajv-formats') as { default?: (a: import('ajv').default) => void }).default ??
  (require('ajv-formats') as unknown as (a: import('ajv').default) => void)
);

const DEFAULTS: Options = {
  strict: true,
  allErrors: true,
  allowUnionTypes: true,
  unevaluated: true,
  validateSchema: false,
};

export function createAjv(overrides: Options = {}): import('ajv').default {
  const ajv = new Ajv2020Impl({ ...DEFAULTS, ...overrides });
  addFormats(ajv);
  return ajv;
}

export function ensureDraft2020<T extends Record<string, unknown>>(schema: T, id?: string): T {
  const out = { ...schema } as Record<string, unknown>;
  if (!out.$schema) out.$schema = 'https://json-schema.org/draft/2020-12/schema';
  if (id && !out.$id) out.$id = id;
  return out as T;
}
