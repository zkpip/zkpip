// packages/core/src/validation/ajv-types.ts
import type {
  ValidateFunction,
  ErrorObject,
  Format,
  FormatDefinition,
} from "ajv";

// Ajv supports string and number format validators.
// Create a convenient union for both cases.
type AnyFormatDefinition =
  | FormatDefinition<string>
  | FormatDefinition<number>;

export interface AjvLike {
  addFormat(
    name: string,
    format: string | Format | AnyFormatDefinition
  ): AjvLike;

  addSchema(schema: object | object[], key?: string): AjvLike;

  getSchema(id: string): ValidateFunction | undefined;

  compile<T = unknown>(schema: object): ValidateFunction<T>;

  validate(schemaKeyRef: string | object, data: unknown): boolean;

  errors?: ErrorObject[] | null;
}

// Use Ajv's exported ValidateFunction for all validators.
export type ValidateFn<T = unknown> = ValidateFunction<T>;
export type AjvError = ErrorObject;

export function assertNoAjvErrors(ajv: AjvLike): void {
  if (ajv.errors && ajv.errors.length > 0) {
    const details = ajv.errors.map(e => `${e.instancePath} ${e.message}`).join("; ");
    throw new Error(`AJV errors: ${details}`);
  }
}
