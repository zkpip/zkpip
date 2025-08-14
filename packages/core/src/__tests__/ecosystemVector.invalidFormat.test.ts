import { describe, it, expect } from "vitest";
import path from "path";
import fs from "fs";
import { createAjv, addCoreSchemas, validateAgainst, CANONICAL_IDS, vectorsDir } from "../schemaUtils.js";

describe("Negative: ecosystem createdAt/updatedAt invalid format", () => {
  it("should fail when createdAt is not a valid date-time", () => {
    const ajv = createAjv();
    addCoreSchemas(ajv);

    const p = path.join(vectorsDir(), "ecosystem-aztec.json");
    const data = JSON.parse(fs.readFileSync(p, "utf8"));

    data.createdAt = "INVALID_DATE";
    const res = validateAgainst(ajv, CANONICAL_IDS["mvs.ecosystem.schema.json"], data);

    expect(res.ok).toBe(false);
    expect(res.errors).toMatch(/createdAt/);
    expect(res.errors).toMatch(/date-time/);
  });
});
