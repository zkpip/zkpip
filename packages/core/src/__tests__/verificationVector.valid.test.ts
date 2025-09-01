// packages/core/src/__tests__/verificationVector.valid.test.ts
import { describe, it, expect } from "vitest";
import { createAjv, addCoreSchemas, CANONICAL_IDS } from "../schemaUtils.js";
import { validateAgainstResult } from "../testing/ajv-helpers.js";
import { vectors, readJson } from "../test-helpers/vectorPaths.js";

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

describe("Vector: verification/groth16-evm.valid.json", () => {
  it("should validate against mvs.verification.schema.json", () => {
    const ajv = createAjv();
    addCoreSchemas(ajv);

    // Use centralized helper (new path with legacy fallback)
    const vecPath = vectors.groth16Valid();
    const parsed: unknown = readJson(vecPath);

    expect(isObject(parsed)).toBe(true);
    const data = parsed as Record<string, unknown>;

    const res = validateAgainstResult(ajv, CANONICAL_IDS.verification, data);

    if (!res.ok) {
      // Fail loudly with detailed message, avoid console.*
      throw new Error(res.text);
    }
    expect(res.ok).toBe(true);
  });
});
