import Ajv from "ajv";
import addFormats from "ajv-formats";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export function makeAjv() {
  const ajv = new Ajv({ allErrors: true, strict: true });
  addFormats(ajv);

  const base = resolve(process.cwd(), "schemas");
  const load = (p: string) =>
    JSON.parse(readFileSync(resolve(base, p), "utf-8"));

  const common = load("common.schema.json");
  ajv.addSchema(common, common.$id);

  ["error.schema.json", "issue.schema.json", "ecosystem.schema.json"].forEach((name) => {
    const s = load(name);
    ajv.addSchema(s, s.$id);
  });

  return ajv;
}
