import { describe, it, expect } from "vitest";
import path from "path";
import fs from "fs";
import { createAjv, addCoreSchemas, CANONICAL_IDS, vectorsDir } from "../schemaUtils.js";
import { validateAgainstResult } from "../testing/ajv-helpers.js";

type EcosystemLike = { languages?: unknown; hashes?: unknown };

function isEcosystemLike(x: unknown): x is EcosystemLike {
  return typeof x === "object" && x !== null && "languages" in x && "hashes" in x;
}

describe("Negative: ecosystem arrays must have at least 1 element", () => {
  it("should fail when languages or hashes are empty", () => {
    const ajv = createAjv();
    addCoreSchemas(ajv);

    const p = path.join(vectorsDir(), "ecosystem-aztec.json");
    const raw = fs.readFileSync(p, "utf8");
    const parsed: unknown = JSON.parse(raw);

    expect(isEcosystemLike(parsed)).toBe(true);
    const data = parsed as Record<string, unknown>;

    // Force empty arrays for the fields under test
    data.languages = [];
    data.hashes = [];

    const res = validateAgainstResult(ajv, CANONICAL_IDS.ecosystem, data);

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.text).toMatch(/languages/);
      expect(res.text).toMatch(/hashes/);
      expect(res.text).toMatch(/must NOT have fewer than 1 items|must contain at least 1 items/);
    }
  });
});
