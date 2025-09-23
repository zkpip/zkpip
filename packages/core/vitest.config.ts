import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/__tests__/**/*.ts'],
  },
  resolve: {
    alias: {
      // Core tests sometimes depend on the CLI's fs-compat helper
      '#fs-compat': path.resolve(__dirname, '../cli/src/utils/fs-compat.ts'),
      '@zkpip/core': path.resolve(__dirname, 'src/index.ts'),
    },
  },
});
