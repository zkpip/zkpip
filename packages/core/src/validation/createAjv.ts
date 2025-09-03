// packages/core/src/validation/createAjv.ts
import type { Options as AjvOptions, ErrorObject } from "ajv";
import * as AjvNS from "ajv";
import addFormatsOrig from "ajv-formats";

export interface AjvInstance {
  addSchema(schema: Record<string, unknown>, key?: string): unknown;
  getSchema(
    id: string
  ):
    | (((data: unknown) => boolean) & { errors?: ErrorObject[] | null })
    | undefined;
  errorsText(
    errors?: ErrorObject[] | null,
    opts?: { separator?: string; dataVar?: string }
  ): string;
}

type AjvCtor = new (opts?: AjvOptions) => AjvInstance;
// Ajv ESM interop (NodeNext + nincs esModuleInterop default):
const Ajv = (AjvNS as unknown as { default: AjvCtor }).default;
// ajv-formats ESM interop:
const addFormats: (ajv: unknown) => unknown =
  addFormatsOrig as unknown as (ajv: unknown) => unknown;

export function createAjv(): AjvInstance {
  const ajv = new Ajv({
    strict: false,
    allErrors: true,
    validateSchema: false,
    allowUnionTypes: true,
  });
  addFormats(ajv);
  return ajv;
}
