import { createAjv } from "./ajv.js";

const ajv = createAjv();

export function validateError(obj: unknown) {
  const validate = ajv.getSchema("https://zkpip.org/schemas/error.schema.json")!;
  const ok = validate(obj);
  return { ok: !!ok, errors: validate.errors ?? [] };
}

export function validateIssue(obj: unknown) {
  const v = ajv.getSchema("https://zkpip.org/schemas/issue.schema.json")!;
  const ok = v(obj);
  return { ok: !!ok, errors: v.errors ?? [] };
}

export function validateEcosystem(obj: unknown) {
  const v = ajv.getSchema("https://zkpip.org/schemas/ecosystem.schema.json")!;
  const ok = v(obj);
  return { ok: !!ok, errors: v.errors ?? [] };
}
