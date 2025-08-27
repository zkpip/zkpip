import { describe, it, expect } from "vitest";
import path from "path";
import fs from "fs";
import * as os from "os";
import * as SU from "../schemaUtils.js";

it("should throw when schemasDir points to an incomplete directory", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zkpip-schemas-"));
  const prev = process.env.ZKPIP_SCHEMAS_DIR;
  process.env.ZKPIP_SCHEMAS_DIR = tmp;
  try {
    const ajv = SU.createAjv();
    expect(() => SU.addCoreSchemas(ajv)).toThrow(/Missing core schema/);
  } finally {
    process.env.ZKPIP_SCHEMAS_DIR = prev;
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
