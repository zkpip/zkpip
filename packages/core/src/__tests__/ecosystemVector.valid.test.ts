import { describe, it, expect } from "vitest";
import path from "path";
import fs from "fs";
import { createAjv, addCoreSchemas, CANONICAL_IDS, vectorsDir } from "../schemaUtils.js";
import { validateAgainstResult } from "../testing/ajv-helpers.js";

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

describe("Vector: ecosystem-aztec.json", () => {
  it("should validate against mvs.ecosystem.schema.json", () => {
    const ajv = createAjv();
    addCoreSchemas(ajv);

    const vecPath = path.join(vectorsDir(), "ecosystem-aztec.json");
    expect(fs.existsSync(vecPath)).toBe(true);

    const raw = fs.readFileSync(vecPath, "utf8");
    const parsed: unknown = JSON.parse(raw);
    expect(isObject(parsed)).toBe(true);
    const data = parsed as Record<string, unknown>;

    const res = validateAgainstResult(ajv, CANONICAL_IDS.ecosystem, data);

    // Kerüljük a console-t; bukás esetén dobjunk hibát a részletes üzenettel
    if (!res.ok) {
      throw new Error(res.text);
    }
    expect(res.ok).toBe(true);
  });
});
