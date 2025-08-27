import { describe, it, expect } from "vitest";
import path from "path";
import fs from "fs";
import { createAjv, addCoreSchemas, CANONICAL_IDS, vectorsDir } from "../schemaUtils.js";
import { validateAgainstResult } from "../testing/ajv-helpers.js";

describe("Negative: ecosystem arrays must have at least 1 element", () => {
  it("should fail when languages or hashes are empty", () => {
    const ajv = createAjv();
    addCoreSchemas(ajv);

    const p = path.join(vectorsDir(), "ecosystem-aztec.json");
    const data = JSON.parse(fs.readFileSync(p, "utf8"));

    data.languages = [];
    data.hashes = [];

    const res = validateAgainstResult(ajv, CANONICAL_IDS.ecosystem, data);

    expect(res.ok).toBe(false);
    if (!res.ok) {
      console.error(res.text);
      expect(res.text).toMatch(/languages/);
      expect(res.text).toMatch(/hashes/);
      expect(res.text).toMatch(/must NOT have fewer than 1 items|must contain at least 1 items/);
    }
  });
});
