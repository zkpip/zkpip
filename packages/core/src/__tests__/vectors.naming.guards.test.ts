// packages/core/src/__tests__/vectors.naming.guards.test.ts
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { MVS_ROOT } from "../test-helpers/vectorPaths.js";

const VERIF = path.join(MVS_ROOT, "verification");

function list(dir: string) { return fs.existsSync(dir) ? fs.readdirSync(dir) : []; }

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
    const dir = path.join(VERIF, "cir");
    const files = list(dir).filter(f => f.endsWith(".json"));
    for (const f of files) {
      expect(/\.valid\.json$|\.invalid\.json$/.test(f)).toBe(true);
    }
  });

  it("ProofBundle vectors use .valid.json / .invalid.json suffixes", () => {
    const dir = path.join(VERIF, "proofBundle");
    const files = list(dir).filter(f => f.endsWith(".json"));
    for (const f of files) {
      expect(/\.valid\.json$|\.invalid\.json$/.test(f)).toBe(true);
    }
  });
});
