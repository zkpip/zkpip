// Keep comments in English only (OSS).
import type { Options as AjvOptions, ErrorObject, ValidateFunction } from 'ajv';
import * as AjvNS from 'ajv'; // value import → ensures runtime emit
import * as AjvFormatsNS from 'ajv-formats'; // value import → ensures runtime emit

/** Narrow runtime surface we rely on across the codebase. */
export interface AjvInstance {
  addSchema(schema: object | object[], key?: string): AjvInstance;
  addFormat(name: string, format: unknown): AjvInstance;
  getSchema(id: string): ValidateFunction | undefined;
  compile<T = unknown>(schema: object): ValidateFunction<T>;
  validate(schemaKeyRef: string | object, data: unknown): boolean;
  errorsText(
    errors?: ErrorObject[] | null,
    opts?: { separator?: string; dataVar?: string },
  ): string;
  errors?: ErrorObject[] | null;
}

/** Newable type of Ajv's default export */
type AjvCtor = new (opts?: AjvOptions) => unknown;

/** ESM/CJS-agnostic extraction of the constructor and addFormats fn */
const Ajv: AjvCtor =
  (AjvNS as unknown as { default?: AjvCtor }).default ?? (AjvNS as unknown as AjvCtor);

const addFormats: (ajv: unknown) => unknown =
  (AjvFormatsNS as unknown as { default?: (a: unknown) => unknown }).default ??
  (AjvFormatsNS as unknown as (a: unknown) => unknown);

/** Minimal runtime shape we need from the core Ajv instance */
interface AjvCore {
  addSchema(schema: object | object[], key?: string): unknown;
  getSchema(id: string): ValidateFunction | undefined;
  compile<T = unknown>(schema: object): ValidateFunction<T>;
  validate(schemaKeyRef: string | object, data: unknown): boolean;
  errorsText(
    errors?: ErrorObject[] | null,
    opts?: { separator?: string; dataVar?: string },
  ): string;
  errors?: ErrorObject[] | null;
}
interface AjvCoreWithFormat extends AjvCore {
  addFormat(name: string, format: unknown): unknown;
}
function hasAddFormat(x: unknown): x is AjvCoreWithFormat {
  return (
    typeof x === 'object' &&
    x !== null &&
    typeof (x as { addFormat?: unknown }).addFormat === 'function'
  );
}

/** Public constants for pinned dialect and canonical IDs (optional export for callers) */
export const JSON_SCHEMA_DIALECT = 'https://json-schema.org/draft/2020-12/schema' as const;

/** ESM-native Ajv factory with stable defaults (unchanged behavior) */
export function createAjv(overrides: AjvOptions = {}): AjvInstance {
  const core = new Ajv({
    strict: false,
    allErrors: true,
    validateSchema: false,     // we don't require meta registration; callers may validate externally
    allowUnionTypes: true,
    ...overrides,
  }) as unknown as AjvCore;

  addFormats(core);

  // Wrap to satisfy fluent AjvInstance
  const wrapped: AjvInstance = {
    addSchema: (schema, key) => {
      core.addSchema(schema, key);
      return wrapped;
    },
    addFormat: (name, format) => {
      if (hasAddFormat(core)) core.addFormat(name, format);
      return wrapped;
    },
    getSchema: core.getSchema.bind(core),
    compile: core.compile.bind(core),
    validate: core.validate.bind(core),
    errorsText: core.errorsText.bind(core),
    get errors() {
      return core.errors ?? null;
    },
  };

  return wrapped;
}

/** ---- New, safe helpers: pin $schema/$id without changing factory behavior ---- */

/** Ensure a schema object carries the pinned $schema and a stable $id (if provided). */
export function ensurePinnedSchema<T extends Record<string, unknown>>(
  schema: T,
  opts?: { id?: string; dialect?: string },
): T {
  const out = { ...schema } as Record<string, unknown>;
  const dialect = opts?.dialect ?? JSON_SCHEMA_DIALECT;
  if (!out.$schema) out.$schema = dialect;
  if (opts?.id && !out.$id) out.$id = opts.id;
  return out as T;
}

/** Compile with pinned $schema/$id and register, returning the ValidateFunction. */
export function compilePinned<T = unknown>(
  ajv: AjvInstance,
  schema: Record<string, unknown>,
  opts?: { id?: string; dialect?: string },
): ValidateFunction<T> {
  const pinned = ensurePinnedSchema(schema, opts);
  // addSchema first (Ajv caches by $id), then retrieve or compile
  ajv.addSchema(pinned);
  const id = (pinned.$id as string | undefined) ?? '';
  const existing = id ? ajv.getSchema(id) as ValidateFunction<T> | undefined : undefined;
  return existing ?? ajv.compile<T>(pinned);
}
