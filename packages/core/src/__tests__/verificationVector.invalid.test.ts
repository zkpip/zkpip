import { describe, it, expect } from "vitest";
import path from "path";
import fs from "fs";
import { createAjv, addCoreSchemas, CANONICAL_IDS, vectorsDir } from "../schemaUtils.js";
import { validateAgainstResult } from "../testing/ajv-helpers.js";

describe("Negative: ecosystem-aztec.json (missing required field)", () => {
  it("should fail when schemaVersion is removed", () => {
    const ajv = createAjv();
    addCoreSchemas(ajv);
    const vecPath = path.join(vectorsDir(), "ecosystem-aztec.json");
    const data = JSON.parse(fs.readFileSync(vecPath, "utf8"));
    delete (data as any).schemaVersion;
    const res = validateAgainstResult(ajv, CANONICAL_IDS.ecosystem, data);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      console.error(res.text);
      expect(res.text).toMatch(/schemaVersion/);
    }
  });
});
