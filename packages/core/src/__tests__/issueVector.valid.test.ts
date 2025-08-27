import { describe, it, expect } from "vitest";
import path from "path";
import fs from "fs";
import { createAjv, addCoreSchemas, CANONICAL_IDS, vectorsDir } from "../schemaUtils.js";
import { validateAgainstResult } from "../testing/ajv-helpers.js";

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

describe("Vector: issue-public-input-order.json", () => {
  it("should validate against mvs.issue.schema.json", () => {
    const ajv = createAjv();
    addCoreSchemas(ajv);

    const vecPath = path.join(vectorsDir(), "issue-public-input-order.json");
    const raw = fs.readFileSync(vecPath, "utf8");
    const parsed: unknown = JSON.parse(raw);
    expect(isObject(parsed)).toBe(true);
    const data = parsed as Record<string, unknown>;

    const res = validateAgainstResult(ajv, CANONICAL_IDS.issue, data);

    if (!res.ok) {
      // no console.* — dobjunk részletes hibát
      throw new Error(res.text);
    }
    expect(res.ok).toBe(true);
  });
});
