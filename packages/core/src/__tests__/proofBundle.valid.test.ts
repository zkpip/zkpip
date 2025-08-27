import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, existsSync } from "fs";
import path from "path";
import {
  createAjv,
  addCoreSchemas,
  CANONICAL_IDS,
  vectorsDir,
} from "../schemaUtils.js";
import { validateAgainstResult } from "../testing/ajv-helpers.js";

function loadJson(p: string): Record<string, unknown> {
  return JSON.parse(readFileSync(p, "utf8")) as Record<string, unknown>;
}

describe("ProofBundle — VALID vectors", () => {
  const ajv = createAjv();
  addCoreSchemas(ajv);

  const dir = vectorsDir();
  const pattern = /^proof-bundle\..*\.valid\.json$/i;
  const files = existsSync(dir)
    ? readdirSync(dir).filter((f) => pattern.test(f))
    : [];

  if (files.length === 0) {
    it.skip("no valid proof-bundle vectors present", () => {
      expect(true).toBe(true);
    });
    return;
  }

  for (const f of files) {
    it(`should accept ${f}`, () => {
      const data = loadJson(path.join(dir, f));
      const res = validateAgainstResult(ajv, CANONICAL_IDS.proofBundle, data);
      if (!res.ok) throw new Error(res.text);
      expect(res.ok).toBe(true);
    });
  }
});
