import { describe, it, expect } from "vitest";
import path from "path";
import fs from "fs";
import { createAjv, addCoreSchemas, CANONICAL_IDS, vectorsDir } from "../schemaUtils.js";
import { validateAgainstResult } from "../testing/ajv-helpers.js";

describe("Negative: ecosystem createdAt/updatedAt invalid format", () => {
  it("should fail when createdAt is not a valid date-time", () => {
    const ajv = createAjv();
    addCoreSchemas(ajv);

    const p = path.join(vectorsDir(), "ecosystem-aztec.json");
    const data = JSON.parse(fs.readFileSync(p, "utf8"));

    data.createdAt = "INVALID_DATE";
    const res = validateAgainstResult(ajv, CANONICAL_IDS.ecosystem, data);

    if (!res.ok) {
      console.error(res.text);
      expect(res.text).toBe(false);
      expect(res.text).toMatch(/createdAt/);
      expect(res.text).toMatch(/date-time/);
    }
  });
});
