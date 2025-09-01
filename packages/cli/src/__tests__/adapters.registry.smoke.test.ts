import { describe, it, expect } from "vitest";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as path from "node:path";

describe("snarkjs-groth16 adapter (direct import)", () => {
  it("module loads and exposes at least one callable (verify/validate/prove)", async () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    // Adjust if the adapter lives elsewhere:
    const abs = path.resolve(here, "../adapters/snarkjs-groth16.js");
    const mod = await import(pathToFileURL(abs).href);

    const adapter = (mod as { default?: unknown }).default ?? mod;
    const callable = ["verify", "validate", "prove"].filter(
      n => typeof (adapter as Record<string, unknown>)?.[n] === "function"
    );
    expect(callable.length).toBeGreaterThan(0);
  });
});
