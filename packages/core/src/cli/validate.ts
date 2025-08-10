import { readFileSync } from "fs";
import { resolve } from "path";
import { makeAjv } from "../validation/ajv.js";
import { pickSchemaId } from "./pickSchemaId.js";

/**
 * Validates the given JSON files against schemas inferred from their file names.
 * Returns an exit code: 0 if all files pass, 1 if any fails.
 */
export function validateFileBatch(files: string[]): number {
  const ajv = makeAjv();
  let failures = 0;

  for (const file of files) {
    const abs = resolve(process.cwd(), file);

    let data: unknown;
    try {
      data = JSON.parse(readFileSync(abs, "utf-8")) as unknown;
    } catch (e) {
       
      console.error(`❌ ${file} is not valid JSON:`, e instanceof Error ? e.message : String(e));
      failures++;
      continue;
    }

    const id = pickSchemaId(file);
    const validate = ajv.getSchema(id);
    if (!validate) {
       
      console.error(`❌ Missing schema validator for '${id}' (file: ${file})`);
      failures++;
      continue;
    }

    const ok = validate(data);
    if (!ok) {
       
      console.error(`❌ ${file} failed against ${id}`, validate.errors ?? []);
      failures++;
    } else {
       
      console.log(`✅ ${file} valid (${id})`);
    }
  }

  return failures === 0 ? 0 : 1;
}
