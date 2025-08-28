// src/__tests__/schemaAliases.valid.test.ts
import { describe, it, expect } from "vitest";
import { createAjv } from "../validation/ajv";
import { addCoreSchemas } from "../validation/addCoreSchemas";
import { CANONICAL_IDS } from "../schemaUtils";

describe("Schema alias coverage", () => {
  it("resolves short dot, short slash, URN, https and filename aliases", () => {
    const ajv = createAjv();
    addCoreSchemas(ajv);

    const entries: Array<[string, string[]]> = [
      [CANONICAL_IDS.proofBundle,  ["mvs.proof-bundle", "mvs/proof-bundle", "mvs.proof-bundle.schema.json"]],
      [CANONICAL_IDS.cir,          ["mvs.cir", "mvs/cir", "mvs.cir.schema.json"]],
      [CANONICAL_IDS.verification, ["mvs.verification", "mvs/verification", "mvs.verification.schema.json"]],
      [CANONICAL_IDS.issue,        ["mvs.issue", "mvs/issue", "mvs.issue.schema.json"]],
      [CANONICAL_IDS.ecosystem,    ["mvs.ecosystem", "mvs/ecosystem", "mvs.ecosystem.schema.json"]],
    ];

    for (const [urn, aliases] of entries) {
      expect(ajv.getSchema(urn)).toBeTruthy();
      const tail = urn.split(":").pop()!;
      const https = `https://zkpip.org/schemas/${tail}`;
      expect(ajv.getSchema(https)).toBeTruthy();
      for (const a of aliases) expect(ajv.getSchema(a)).toBeTruthy();
    }
  });
});
