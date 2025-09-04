// packages/core/src/validation/ajv.ts
import AjvModule from 'ajv';
import addFormats from 'ajv-formats';
import type { Options as AjvOptions, ValidateFunction, ErrorObject } from 'ajv';

export interface AjvLike {
  addSchema: (schema: unknown, key?: string) => unknown;
  addFormat: (name: string, format: unknown) => AjvLike;
  compile: (schema: unknown) => ValidateFunction;                 
  getSchema: (id: string) => ValidateFunction | undefined;        
  errorsText: (
    errors?: ErrorObject[] | null,                                
    opts?: { separator?: string; dataVar?: string },
  ) => string;
}

type AjvCtor = new (opts?: AjvOptions) => AjvLike;

const AjvClass: AjvCtor =
  ((AjvModule as unknown as { default?: AjvCtor }).default ??
   (AjvModule as unknown as AjvCtor));

export function createAjv(): AjvLike {
  const ajv = new AjvClass({
    allErrors: true,
    strict: false,
    allowUnionTypes: true,
    validateSchema: false,
  } satisfies AjvOptions);

  type AddFormatsFn = (ajv: AjvLike, opts?: unknown) => unknown;
  const addFormatsTyped = addFormats as unknown as AddFormatsFn;
  addFormatsTyped(ajv);

  return ajv;
}

export type AjvInstance = ReturnType<typeof createAjv>;
