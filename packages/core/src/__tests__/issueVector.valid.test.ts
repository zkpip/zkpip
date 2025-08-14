import { describe, it, expect } from "vitest";
import path from "path";
import fs from "fs";
import { createAjv, addCoreSchemas, validateAgainst, CANONICAL_IDS, vectorsDir } from "../schemaUtils.js";

describe("Vector: issue-public-input-order.json", () => {
  it("should validate against mvs.issue.schema.json", () => {
    const ajv = createAjv();
    addCoreSchemas(ajv);
    const vecPath = path.join(vectorsDir(), "issue-public-input-order.json");
    const data = JSON.parse(fs.readFileSync(vecPath, "utf8"));
    const res = validateAgainst(ajv, CANONICAL_IDS["mvs.issue.schema.json"], data);
    if (!res.ok) console.error(res.errors);
    expect(res.ok).toBe(true);
  });
});
