// packages/core/src/__tests__/proofBundle.invalid.test.ts
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { createAjv, addCoreSchemas, CANONICAL_IDS } from "../schemaUtils.js";
import { validateAgainstResult } from "../testing/ajv-helpers.js";
import { MVS_ROOT, readJson } from "../test-helpers/vectorPaths.js";

/** Collect invalid proofBundle vectors from the new layout; fallback to legacy flat files. */
function collectInvalidProofBundleVectors(): string[] {
  const newDir = path.join(MVS_ROOT, "verification/proofBundle");
  const legacyDir = MVS_ROOT; // legacy flat files lived under mvs/

  // Prefer new layout: verification/proofBundle/*.invalid.json
  if (fs.existsSync(newDir)) {
    const files = fs
      .readdirSync(newDir)
      .filter((f) => f.toLowerCase().endsWith(".invalid.json"))
      .map((f) => path.join(newDir, f));
    if (files.length > 0) return files;
  }

  // Fallback: legacy files like proof-bundle.*.invalid.json under mvs/
  const legacyPattern = /^proof-bundle\..*\.invalid\.json$/i;
  if (fs.existsSync(legacyDir)) {
    const files = fs
      .readdirSync(legacyDir)
      .filter((f) => legacyPattern.test(f))
      .map((f) => path.join(legacyDir, f));
    if (files.length > 0) return files;
  }

  return [];
}

describe("ProofBundle — INVALID vectors", () => {
  const ajv = createAjv();
  addCoreSchemas(ajv);

  const files = collectInvalidProofBundleVectors();

  if (files.length === 0) {
    it.skip("no invalid proof-bundle vectors present", () => {
      expect(true).toBe(true);
    });
    return;
  }

  for (const abs of files) {
    const name = path.basename(abs);
    it(`should reject ${name}`, () => {
      const data = readJson(abs) as Record<string, unknown>;
      const res = validateAgainstResult(ajv, CANONICAL_IDS.proofBundle, data);
      expect(res.ok).toBe(false);
    });
  }
});
