// Tiny helper to validate a batch of JSON files against registered schemas.
import { readFileSync } from "fs";
import { resolve } from "path";
import { makeAjv } from "../validation/ajv.js";

const ajv = makeAjv();

// Resolve schema by heuristics from filename; customize as needed.
function pickSchemaId(file: string): string {
  const f = file.toLowerCase();
  if (f.includes("error")) return "https://zkpip.org/schemas/error.schema.json";
  if (f.includes("issue")) return "https://zkpip.org/schemas/issue.schema.json";
  return "https://zkpip.org/schemas/ecosystem.schema.json";
}

export async function validateFileBatch(files: string[]) {
  const failed: string[] = [];
  for (const file of files) {
    const json = JSON.parse(readFileSync(resolve(process.cwd(), file), "utf-8"));
    const id = pickSchemaId(file);
    const validate = ajv.getSchema(id);
    const ok = validate && validate(json);
    if (!ok) {
      console.error(`❌ ${file} failed against ${id}`, validate?.errors);
      failed.push(file);
    } else {
      console.log(`✅ ${file} valid (${id})`);
    }
  }
  return { failed };
}
