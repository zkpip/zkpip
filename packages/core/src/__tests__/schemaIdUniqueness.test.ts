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
      const p = path.join(schemasDir(), n);                    // ← string típusú
      const s = readJson<Record<string, unknown>>(p);          // ← nincs any

      expect(seen.has(n)).toBe(false);
      seen.add(n);

      expect(typeof s).toBe("object");
      expect(s).not.toBeNull();
    }
  });
});
