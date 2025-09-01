// packages/core/src/__tests__/cir.valid.test.ts
import { describe, it, expect } from "vitest";
import { createAjv, addCoreSchemas, CANONICAL_IDS } from "../schemaUtils.js";
import { validateAgainstResult } from "../testing/ajv-helpers.js";
import { MVS_ROOT, readJson } from "../test-helpers/vectorPaths.js";
import * as path from "node:path";
import * as fs from "node:fs";

describe("CIR — VALID vectors", () => {
  const ajv = createAjv();
  addCoreSchemas(ajv);

  const cirDir = path.join(MVS_ROOT, "verification/cir");

  const files = fs.existsSync(cirDir)
    ? fs.readdirSync(cirDir).filter((f) => f.endsWith(".valid.json"))
    : [];

  if (files.length === 0) {
    it.skip("no valid CIR vectors present", () => {
      expect(true).toBe(true);
    });
    return;
  }

  for (const f of files) {
    it(`should accept ${f}`, () => {
      const abs = path.join(cirDir, f);
      const data = readJson(abs) as Record<string, unknown>;
      const res = validateAgainstResult(ajv, CANONICAL_IDS.cir, data);
      if (!res.ok) throw new Error(res.text);
      expect(res.ok).toBe(true);
    });
  }
});
