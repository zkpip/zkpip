import { describe, it, expect } from "vitest";
import { createAjv } from "../validation/ajv.js";
import { addCoreSchemas } from "../validation/addCoreSchemas.js";
import { ALIASES, httpsAliasOf } from "../validation/aliases.js";

describe("Schema alias coverage", () => {
  it("resolves short dot, short slash, URN, https and filename aliases", () => {
    const ajv = createAjv();
    addCoreSchemas(ajv);

    for (const [canonicalUrn, aliasList] of Object.entries(ALIASES)) {
      // canonical must be registered
      expect(ajv.getSchema(canonicalUrn)).toBeTruthy();

      // https alias must be registered
      expect(ajv.getSchema(httpsAliasOf(canonicalUrn))).toBeTruthy();

      // every configured alias must be registered
      for (const a of aliasList) {
        expect(ajv.getSchema(a)).toBeTruthy();
      }
    }
  });
});
