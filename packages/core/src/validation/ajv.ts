// src/validation/ajv.ts

import Ajv2020Module from "ajv/dist/2020.js";
import type { Options, ValidateFunction, ErrorObject, AnySchema } from "ajv";
import addFormatsImport from "ajv-formats";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const Ajv2020 = Ajv2020Module as unknown as { new (opts?: Options): unknown };
const addFormats = addFormatsImport as unknown as (ajv: unknown) => void;

type AjvLike = {
  addSchema: (schema: AnySchema, key?: string) => void;
  getSchema: (id: string) => ValidateFunction<unknown> | undefined;
  // add compile so tests (and callers) can compile ad-hoc schemas
  compile: (schema: AnySchema) => ValidateFunction<unknown>;
};

export type AjvInstance = AjvLike;
export type AjvErrors = ErrorObject[] | null;
export type Validator = ValidateFunction<unknown>;

// --- NEW: safe $id extractor without using `any`
function getSchemaId(schema: AnySchema): string | undefined {
  if (schema && typeof schema === 'object' && '$id' in schema) {
    const value = (schema as { $id?: unknown }).$id;
    return typeof value === 'string' ? value : undefined;
  }
  return undefined;
}

export function makeAjv(): AjvInstance {
  const ajv = new Ajv2020({
    strict: true,
    allErrors: true,
    allowUnionTypes: true,
  } as Options) as AjvInstance;

  addFormats(ajv as unknown);

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const repoRoot = resolve(__dirname, "../../../../");

  const base = existsSync(resolve(repoRoot, "schemas"))
    ? resolve(repoRoot, "schemas")
    : resolve(process.cwd(), "schemas");

  const load = (p: string): AnySchema =>
    JSON.parse(readFileSync(resolve(base, p), "utf-8")) as AnySchema;

  // Register schemas with a safe $id lookup
  const common = load("common.schema.json");
  ajv.addSchema(common, getSchemaId(common));

  for (const name of ["error.schema.json", "issue.schema.json", "ecosystem.schema.json"]) {
    const s = load(name);
    ajv.addSchema(s, getSchemaId(s));
  }

  return ajv;
}

export function getValidator(ajv: AjvInstance, schemaId: string): Validator | undefined {
  return ajv.getSchema(schemaId);
}

export function validateById(ajv: AjvInstance, schemaId: string, data: unknown): {
  valid: boolean;
  errors: AjvErrors;
} {
  const fn = getValidator(ajv, schemaId);
  if (!fn) {
    return {
      valid: false,
      errors: [
        {
          instancePath: "",
          schemaPath: "",
          keyword: "notFound",
          params: { missingSchema: schemaId },
          message: `Schema not found: ${schemaId}`,
        } as unknown as ErrorObject
      ]
    };
  }
  const ok = fn(data);
  return { valid: Boolean(ok), errors: fn.errors ?? null };
}
