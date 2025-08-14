import { describe, it, expect } from "vitest";
import { createAjv, addCoreSchemas, CANONICAL_IDS } from "../schemaUtils.js";

describe("Core schemas compile", () => {
  it("should load and register all 4 core schemas with canonical $id", () => {
    const ajv = createAjv();
    addCoreSchemas(ajv);
    for (const id of Object.values(CANONICAL_IDS)) {
      const s = ajv.getSchema(id);
      expect(typeof s).toBe("function");
    }
  });
});
