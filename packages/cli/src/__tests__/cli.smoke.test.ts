// Keep comments in English (OSS).
import { describe, it, expect } from "vitest";

// Import a couple of command modules to ensure they are loadable.
// Adjust the list if your command filenames differ.
const commandModules = [
  "../commands/verify.ts",
  "../commands/validate.ts",
  "../commands/vectors-validate.ts",
] as const;

describe("CLI smoke tests", () => {
  for (const rel of commandModules) {
    it(`imports ${rel}`, async () => {
      const mod = await import(rel);
      // Basic sanity assertions; extend later as the command API stabilizes
      expect(typeof mod).toBe("object");
      // Optional: common yargs fields if you export them
      // e.g., expect(typeof (mod as any).command).toBe("string");
      //       expect(typeof (mod as any).handler).toBe("function");
    });
  }
});
