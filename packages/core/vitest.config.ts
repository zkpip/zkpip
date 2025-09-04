// packages/core/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/__tests__/**/*.ts', 'src/**/*.test.ts', 'src/**/*.spec.ts'],
    exclude: ['dist/**', 'schemas/**', 'coverage/**'],

    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: 'coverage',

      include: ['src/**/*.ts'],
      exclude: ['src/**/__tests__/**', 'src/**/*.{test,spec}.ts', '**/*.d.ts'],

      all: true,
    },
  },
});
