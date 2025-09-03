// packages/core/src/__tests__/schemaUtils.missingSchema.test.ts
import { it, expect } from "vitest";
import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";
import { createAjv, addCoreSchemas } from "../index.js";

it("should throw when schemasDir points to an incomplete directory", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zkpip-schemas-"));
  const prev = process.env.ZKPIP_SCHEMAS_DIR;
  process.env.ZKPIP_SCHEMAS_DIR = tmp;

  try {
    const ajv = createAjv();
    // Új hibaüzenet ellenőrzése
    expect(() => addCoreSchemas(ajv)).toThrow(/Schema file not found/i);
  } finally {
    if (prev !== undefined) {
      process.env.ZKPIP_SCHEMAS_DIR = prev;
    } else {
      delete process.env.ZKPIP_SCHEMAS_DIR;
    }
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
