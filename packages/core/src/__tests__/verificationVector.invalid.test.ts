import { describe, it, expect } from "vitest";
import path from "path";
import fs from "fs";
import { createAjv, addCoreSchemas, validateAgainst, CANONICAL_IDS, vectorsDir } from "../schemaUtils.js";

describe("Negative: ecosystem-aztec.json (missing required field)", () => {
  it("should fail when schemaVersion is removed", () => {
    const ajv = createAjv();
    addCoreSchemas(ajv);
    const vecPath = path.join(vectorsDir(), "ecosystem-aztec.json");
    const data = JSON.parse(fs.readFileSync(vecPath, "utf8"));
    delete (data as any).schemaVersion;
    const res = validateAgainst(ajv, CANONICAL_IDS["mvs.ecosystem.schema.json"], data);
    expect(res.ok).toBe(false);
    expect(res.errors).toMatch(/schemaVersion/);
  });
});
