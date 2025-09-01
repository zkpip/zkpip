// packages/core/src/__tests__/vectors.naming.guards.test.ts
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { MVS_ROOT } from "../test-helpers/vectorPaths.js";

const VERIF = path.join(MVS_ROOT, "verification");

function list(dir: string): string[] {
  return fs.existsSync(dir) ? fs.readdirSync(dir) : [];
}

/** Assert that all JSON files under `dir` end with .valid.json or .invalid.json. */
function mustHaveValidInvalidSuffix(dir: string): void {
  const files = list(dir).filter((f) => f.toLowerCase().endsWith(".json"));
  const offenders = files.filter((f) => !/\.valid\.json$|\.invalid\.json$/i.test(f));
  expect(
    offenders,
    `Files violating suffix rule in ${dir}: ${offenders.join(", ")}`
  ).toEqual([]);
}

describe("Vectors layout guards", () => {
  it("has no duplicated folder names (e.g., cir/cir)", () => {
    for (const d of list(VERIF)) {
      const child = path.join(VERIF, d);
      if (!fs.statSync(child).isDirectory()) continue;
      const nested = path.join(child, path.basename(child));
      expect(fs.existsSync(nested)).toBe(false);
    }
  });

  it("CIR vectors use .valid.json / .invalid.json suffixes", () => {
    mustHaveValidInvalidSuffix(path.join(VERIF, "cir"));
  });

  it("ProofBundle vectors use .valid.json / .invalid.json suffixes", () => {
    mustHaveValidInvalidSuffix(path.join(VERIF, "proofBundle"));
  });

  it("Issue vectors use .valid.json / .invalid.json suffixes", () => {
    mustHaveValidInvalidSuffix(path.join(MVS_ROOT, "issue"));
  });

  it("Ecosystem vectors use .valid.json / .invalid.json suffixes", () => {
    mustHaveValidInvalidSuffix(path.join(MVS_ROOT, "ecosystem"));
  });
});
