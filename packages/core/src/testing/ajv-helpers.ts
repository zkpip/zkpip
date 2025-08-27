// packages/core/src/testing/ajv-helpers.ts

import * as Ajv2020NS from "ajv/dist/2020.js";
import * as addFormatsNS from "ajv-formats";
import type { ErrorObject } from "ajv/dist/2020.js";

type Ajv = import("ajv").default;
type AjvOptions = import("ajv").Options;

const Ajv2020: new (opts?: AjvOptions) => Ajv =
  (Ajv2020NS as unknown as { default: new (opts?: AjvOptions) => Ajv }).default;

const addFormats: (ajv: Ajv) => Ajv =
  ((addFormatsNS as unknown as { default?: (a: Ajv) => Ajv }).default ??
   (addFormatsNS as unknown as (a: Ajv) => Ajv));

export function createAjvStrict(): Ajv {
  const ajv = new Ajv2020({
    strict: true,
    allErrors: true,
    allowUnionTypes: true,
  });
  addFormats(ajv);
  return ajv;
}

export function validateAgainst(
  ajv: Ajv,
  schemaId: string,
  data: unknown,
  label?: string
): void {
  const validator =
    ajv.getSchema(schemaId) ?? ajv.compile({ $ref: schemaId });

  const ok = validator(data);
  if (!ok) {
    const msg = ajv.errorsText(validator.errors || [], { separator: "\n" });
    const err = new Error(
      `Validation failed${label ? ` for ${label}` : ""} against ${schemaId}:\n${msg}`
    ) as Error & { errors?: unknown };
    err.errors = validator.errors;
    throw err;
  }
}

export type ValidationResult =
  | { ok: true }
  | { ok: false; errors: ErrorObject[]; text: string };

/** Nem dobós wrapper: visszaadja az eredményt ok/hibák formában. */
export function validateAgainstResult(
  ajv: Ajv,
  schemaId: string,
  data: unknown,
  label?: string
): ValidationResult {
  try {
    const validator =
      ajv.getSchema(schemaId) ?? ajv.compile({ $ref: schemaId });

    const ok = validator(data);
    if (ok) return { ok: true };

    const errors = validator.errors ?? [];
    const text = ajv.errorsText(errors, { separator: "\n" });
    return {
      ok: false,
      errors,
      text: `Validation failed${label ? ` for ${label}` : ""} against ${schemaId}:\n${text}`,
    };
  } catch (e) {
    return {
      ok: false,
      errors: [],
      text: `Validation crashed${label ? ` for ${label}` : ""} against ${schemaId}: ${String(e)}`,
    };
  }
}
