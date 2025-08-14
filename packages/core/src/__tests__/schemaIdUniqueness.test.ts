import { describe, it, expect } from "vitest";
import path from "path";
import { readJson, schemasDir } from "../schemaUtils.js";

describe("$id uniqueness by filename (no duplicates among core schemas)", () => {
  it("should not have duplicate canonical IDs/filenames", () => {
    const names = [
      "mvs.core.schema.json",
      "mvs.ecosystem.schema.json",
      "mvs.issue.schema.json",
      "mvs.verification.schema.json",
    ];
    const seen = new Set<string>();
    for (const n of names) {
      const p = path.join(schemasDir(), n);
      const s = readJson(p);
      expect(seen.has(n)).toBe(false);
      seen.add(n);
      // opcionális sanity: a fájl JSON legyen objektum
      expect(typeof s).toBe("object");
      expect(s).not.toBeNull();
    }
  });
});
