import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    reporters: ["dot"],
    include: ["src/__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "lcov"],
      reportsDirectory: "coverage",
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 70,
        branches: 60
      },
      // 🔽 csak a ténylegesen tesztelt, kritikus utilra mérünk
      include: ["src/schemaUtils.ts"],
      exclude: ["src/__tests__/**"]
    }
  }
});

