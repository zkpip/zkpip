import { describe, it, expect } from "vitest";
import path from "path";
import fs from "fs";
import { createAjv, addCoreSchemas, CANONICAL_IDS, vectorsDir } from "../schemaUtils.js";
import { validateAgainstResult } from "../testing/ajv-helpers.js";

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

describe("Vector: verification-groth16-evm.json", () => {
  it("should validate against mvs.verification.schema.json", () => {
    const ajv = createAjv();
    addCoreSchemas(ajv);

    const vecPath = path.join(vectorsDir(), "verification-groth16-evm.json");
    const raw = fs.readFileSync(vecPath, "utf8");
    const parsed: unknown = JSON.parse(raw);
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
