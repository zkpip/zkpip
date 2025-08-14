import { describe, it, expect, vi } from "vitest";
import path from "path";
import fs from "fs";
import * as SU from "../schemaUtils.js";

describe("addCoreSchemas: throws if a core schema file is missing", () => {
  it("should throw when schemasDir points to an incomplete directory", () => {
    const tmp = fs.mkdtempSync(path.join(process.cwd(), ".tmp-schemas-"));
    try {
      // Csak 1 séma; a többi hiányzik → dobnia kell
      const minimal = { $schema: "https://json-schema.org/draft/2020-12/schema", type: "object" };
      fs.writeFileSync(path.join(tmp, "mvs.core.schema.json"), JSON.stringify(minimal));

      const ajv = SU.createAjv();
      expect(() => SU.addCoreSchemas(ajv, tmp)).toThrow(/Missing core schema/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
