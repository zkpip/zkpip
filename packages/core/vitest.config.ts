// packages/core/vitest.config.ts
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      '@zkpip/core': path.resolve(__dirname, '../core/src/index.ts')
    }
  },
  test: {
    include: ["src/__tests__/**/*.ts", "src/**/*.test.ts", "src/**/*.spec.ts"],
    exclude: ["dist/**", "schemas/**", "coverage/**"],
    environment: 'node',
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "coverage",
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/__tests__/**",
        "src/**/*.{test,spec}.ts",
        "**/*.d.ts",
      ],
      all: true,
    },
  },
});
