// packages/core/src/__tests__/ecosystemVector.invalid.test.ts
import { describe, it, expect } from "vitest";
import { createAjv, addCoreSchemas, CANONICAL_IDS } from "../index.js";
import { validateAgainstResult } from "../testing/ajv-helpers.js";
import { vectors, readJson } from "../test-helpers/vectorPaths.js";

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

describe("Negative: ecosystem/aztec.json (missing required field)", () => {
  it("should fail when schemaVersion is removed", () => {
    const ajv = createAjv();
    addCoreSchemas(ajv);

    const vecPath = vectors.ecosystemAztec();
    const parsed: unknown = readJson(vecPath);

    if (!isObject(parsed)) throw new Error("Expected JSON object");

    const data: Record<string, unknown> = { ...parsed };
    delete (data as { schemaVersion?: unknown }).schemaVersion;

    const res = validateAgainstResult(ajv, CANONICAL_IDS.ecosystem, data);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.text).toMatch(/schemaVersion/);
    }
  });
});
