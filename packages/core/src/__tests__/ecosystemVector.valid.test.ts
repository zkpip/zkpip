import { describe, it, expect } from "vitest";
import path from "path";
import fs from "fs";
import { createAjv, addCoreSchemas, CANONICAL_IDS, vectorsDir } from "../schemaUtils.js";
import { validateAgainstResult } from "../testing/ajv-helpers.js";

describe("Vector: ecosystem-aztec.json", () => {
  it("should validate against mvs.ecosystem.schema.json", () => {
    const ajv = createAjv();
    addCoreSchemas(ajv);
    const vecPath = path.join(vectorsDir(), "ecosystem-aztec.json");
    expect(fs.existsSync(vecPath)).toBe(true);
    const data = JSON.parse(fs.readFileSync(vecPath, "utf8"));
    const res = validateAgainstResult(ajv, CANONICAL_IDS.ecosystem, data);
    if (!res.ok) console.error(res.errors);
    expect(res.ok).toBe(true);
  });
});
