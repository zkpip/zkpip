import { describe, it, expect } from "vitest";
import path from "path";
import fs from "fs";
import { createAjv, addCoreSchemas, CANONICAL_IDS, vectorsDir } from "../schemaUtils.js";
import { validateAgainstResult } from "../testing/ajv-helpers.js";

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

describe("Negative: ecosystem-aztec.json (missing required field)", () => {
  it("should fail when schemaVersion is removed", () => {
    const ajv = createAjv();
    addCoreSchemas(ajv);

    const vecPath = path.join(vectorsDir(), "ecosystem-aztec.json");
    const raw = fs.readFileSync(vecPath, "utf8");
    const parsed: unknown = JSON.parse(raw);

    if (!isObject(parsed)) throw new Error("Expected JSON object");
    const data: Record<string, unknown> = { ...parsed }; 

    delete data["schemaVersion"];

    const res = validateAgainstResult(ajv, CANONICAL_IDS.ecosystem, data);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.text).toMatch(/schemaVersion/);
    }
  });
});
