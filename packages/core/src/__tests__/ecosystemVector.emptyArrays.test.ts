import { describe, it, expect } from "vitest";
import path from "path";
import fs from "fs";
import { createAjv, addCoreSchemas, validateAgainst, CANONICAL_IDS, vectorsDir } from "../schemaUtils.js";

describe("Negative: ecosystem arrays must have at least 1 element", () => {
  it("should fail when languages or hashes are empty", () => {
    const ajv = createAjv();
    addCoreSchemas(ajv);

    const p = path.join(vectorsDir(), "ecosystem-aztec.json");
    const data = JSON.parse(fs.readFileSync(p, "utf8"));

    data.languages = [];
    data.hashes = [];

    const res = validateAgainst(ajv, CANONICAL_IDS["mvs.ecosystem.schema.json"], data);

    expect(res.ok).toBe(false);
    expect(res.errors).toMatch(/languages/);
    expect(res.errors).toMatch(/hashes/);
    expect(res.errors).toMatch(/must NOT have fewer than 1 items|must contain at least 1 items/);
  });
});
