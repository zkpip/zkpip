import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    reporters: ["dot"],
    include: ["src/__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "lcov"],
      reportsDirectory: "coverage",
      thresholds: { lines: 80, functions: 80, branches: 75, statements: 80 },
      include: ["src/schemaUtils.ts"],
      exclude: ["src/__tests__/**"]
    }
  }
});

