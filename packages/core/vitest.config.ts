import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: 'coverage',
      include: [
        'src/cli/**/*.{ts,tsx}',
        'src/validation/**/*.{ts,tsx}',
      ],
      exclude: [
        '**/__tests__/**',
        '**/dist/**',
        '**/*.d.ts',
        'src/index.ts',
        'src/validation/validators.ts',
      ],
      all: true,
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 55,
        statements: 60,
      },
    },
  },
});
