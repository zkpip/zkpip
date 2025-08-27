// CLI entry for JSON Schema validation.
// Uses schemaUtils bootstrap (createAjv + addCoreSchemas) and the filename-based picker.

import { readFileSync } from "fs";
import { resolve } from "path";
import { createAjv, addCoreSchemas } from "../schemaUtils.js";
import { pickSchemaId } from "./pickSchemaId.js";
import type { ErrorObject } from "ajv";

/** Ajv hibákat hordozó Error típus (tesztekhez hasznos). */
type AjvErrorCarrier = Error & { errors?: ErrorObject[] | null };

/**
 * Validate a single JSON file against a schema picked from its filename.
 * Throws an Error on validation failure; resolves (void) on success.
 */
export async function validatePath(inputPath: string): Promise<void> {
  const abs = resolve(inputPath);
  const raw = readFileSync(abs, "utf-8");

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    throw new Error(`Invalid JSON: ${abs}\n${String(e)}`);
  }

  // Bootstrap AJV (2020-12) with all core schemas
  const ajv = createAjv();
  addCoreSchemas(ajv);

  // Pick target schema based on filename heuristics
  const schemaId = pickSchemaId(abs);

  const validate = ajv.getSchema(schemaId);
  if (!validate) {
    throw new Error(
      `Schema not registered in AJV: ${schemaId}\n` +
        `Ensure the corresponding schema file exists under /schemas and has a proper "$id".`
    );
  }

  const ok = validate(data);
  if (!ok) {
    // Build a readable error message; attach raw errors for tests if needed
    const msg = ajv.errorsText(validate.errors, { separator: "\n" });
    const err: AjvErrorCarrier = new Error(
      `Validation failed for ${abs}\nSchema: ${schemaId}\n${msg}`
    );
    err.errors = validate.errors ?? null;
    throw err;
  }
}

/**
 * Thin CLI wrapper: keeps current behavior (exit codes, console output).
 * Usage: node dist/cli/validate.js <path-to-json>
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  void (async () => {
    const fileArg = process.argv[2];
    if (!fileArg) {
      console.error("Usage: zkpip-validate <path-to-json>");
      process.exit(2);
    }
    try {
      await validatePath(fileArg);
      console.log("✅ Validation OK");
      process.exit(0);
    } catch (e) {
      console.error(String(e instanceof Error ? e.message : e));
      process.exit(1);
    }
  })();
}
