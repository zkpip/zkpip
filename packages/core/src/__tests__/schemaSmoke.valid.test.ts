import { describe, it, expect } from "vitest";
import { createAjv } from "../validation/ajv.js";
import { addCoreSchemas } from "../validation/addCoreSchemas.js";

describe("Core Schemas Smoke", () => {
  it("loads core schemas without error", () => {
    const ajv = createAjv();
    expect(() => addCoreSchemas(ajv)).not.toThrow();
    expect(ajv.getSchema("mvs/proof-bundle")).toBeTruthy();
    expect(ajv.getSchema("mvs/cir")).toBeTruthy();
  });
});
