// packages/core/vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // csak a tesztfájlok:
    include: ["src/__tests__/**/*.ts", "src/**/*.test.ts", "src/**/*.spec.ts"],
    exclude: ["dist/**", "schemas/**", "coverage/**"],

    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "coverage",

      // csak a forráskódot mérjük:
      include: ["src/**/*.ts"],
      // és kizárjuk a teszteket, deklarációkat:
      exclude: [
        "src/**/__tests__/**",
        "src/**/*.{test,spec}.ts",
        "**/*.d.ts",
      ],

      // minden, az include által lefedett fájl szerepeljen a riportban,
      // akkor is, ha a teszt nem érintette
      all: true,
    },
  },
});
