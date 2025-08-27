// packages/core/src/__tests__/compileCoreSchemas.test.ts
import { describe, it, expect } from "vitest";
import { createAjv, addCoreSchemas, CANONICAL_IDS } from "../schemaUtils.js";
import type { ValidateFunction } from "ajv";

function isValidateFn(x: unknown): x is ValidateFunction {
  return typeof x === "function";
}

describe("Core schemas compile", () => {
  it("should load and register all 4 core schemas with canonical $id", () => {
    const ajv = createAjv();       // Ajv típusú lesz
    addCoreSchemas(ajv);

    for (const id of Object.values(CANONICAL_IDS)) {
      const maybe = ajv.getSchema(id); // ValidateFunction | undefined
      expect(maybe).toBeTruthy();
      if (!isValidateFn(maybe)) {
        throw new Error(`Schema is not a validate function: ${id}`);
      }
      expect(typeof maybe).toBe("function");
    }
  });
});
