// Keep comments in English only (OSS).
import type { Options as AjvOptions, ErrorObject, ValidateFunction } from "ajv";
import * as AjvNS from "ajv";              // value import → ensures runtime emit
import * as AjvFormatsNS from "ajv-formats"; // value import → ensures runtime emit

/**
 * Narrow runtime surface we rely on across the codebase.
 */
export interface AjvInstance {
  addSchema(schema: object | object[], key?: string): AjvInstance;
  getSchema(id: string): ValidateFunction | undefined;
  compile<T = unknown>(schema: object): ValidateFunction<T>;
  validate(schemaKeyRef: string | object, data: unknown): boolean;
  errorsText(
    errors?: ErrorObject[] | null,
    opts?: { separator?: string; dataVar?: string }
  ): string;
  errors?: ErrorObject[] | null;
}

/** Newable type of Ajv's default export */
type AjvCtor = new (opts?: AjvOptions) => unknown;

/** ESM/CJS-agnostic extraction of the constructor and addFormats fn */
const Ajv: AjvCtor =
  ((AjvNS as unknown as { default?: AjvCtor }).default ??
    (AjvNS as unknown as AjvCtor));

const addFormats: (ajv: unknown) => unknown =
  ((AjvFormatsNS as unknown as { default?: (a: unknown) => unknown }).default ??
    (AjvFormatsNS as unknown as (a: unknown) => unknown));

/**
 * ESM-native Ajv factory with stable defaults.
 */
export function createAjv(overrides: AjvOptions = {}): AjvInstance {
  const ajv = new Ajv({
    strict: false,
    allErrors: true,
    validateSchema: false,
    allowUnionTypes: true,
    ...overrides,
  });
  addFormats(ajv);
  return ajv as AjvInstance;
}
