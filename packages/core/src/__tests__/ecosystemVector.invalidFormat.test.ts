import { describe, it, expect } from "vitest";
import path from "path";
import fs from "fs";
import { createAjv, addCoreSchemas, CANONICAL_IDS, vectorsDir } from "../schemaUtils.js";
import { validateAgainstResult } from "../testing/ajv-helpers.js";

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

describe("Negative: ecosystem createdAt/updatedAt invalid format", () => {
  it("should fail when createdAt is not a valid date-time", () => {
    const ajv = createAjv();
    addCoreSchemas(ajv);

    const p = path.join(vectorsDir(), "ecosystem-aztec.json");
    const raw = fs.readFileSync(p, "utf8");
    const parsed: unknown = JSON.parse(raw);

    if (!isObject(parsed)) {
      throw new Error("Parsed JSON is not an object");
    }

    const data: Record<string, unknown> = { ...parsed };

    // set invalid value
    data.createdAt = "INVALID_DATE";

    const res = validateAgainstResult(ajv, CANONICAL_IDS.ecosystem, data);

    // assert failure without console.*
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.text).toMatch(/createdAt/);
      expect(res.text).toMatch(/date-time/);
    }
  });
});
