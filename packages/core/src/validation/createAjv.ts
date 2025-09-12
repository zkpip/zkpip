// Keep comments in English only (OSS).
import type { Options as AjvOptions, ErrorObject, ValidateFunction } from 'ajv';
import * as AjvNS from 'ajv'; // value import → ensures runtime emit
import * as AjvFormatsNS from 'ajv-formats'; // value import → ensures runtime emit

/** Narrow runtime surface we rely on across the codebase. */
export interface AjvInstance {
  addSchema(schema: object | object[], key?: string): AjvInstance;
  addFormat(name: string, format: unknown): AjvInstance; // ⬅️ added
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

/** ESM-native Ajv factory with stable defaults. */
export function createAjv(overrides: AjvOptions = {}): AjvInstance {
  const core = new Ajv({
    strict: false,
    allErrors: true,
    validateSchema: false,
    allowUnionTypes: true,
    ...overrides,
  }) as unknown as AjvCore;

  addFormats(core);

  // Wrap to satisfy fluent AjvInstance (addFormat returns AjvInstance)
  const wrapped: AjvInstance = {
    addSchema: (schema, key) => {
      core.addSchema(schema, key);
      return wrapped;
    },
    addFormat: (name, format) => {
      if (hasAddFormat(core)) {
        core.addFormat(name, format);
      }
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
