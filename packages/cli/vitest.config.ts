import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.{test,e2e}.ts'],
    exclude: ['src/**/__tests__/helpers/**', 'src/**/helpers/**'],
  },
  resolve: {
    alias: {
      '#fs-compat': path.resolve(__dirname, 'src/utils/fs-compat.ts'),
      '#paths': path.resolve(__dirname, 'src/utils/paths.ts'),
      '@zkpip/core': path.resolve(__dirname, '../core/src/index.ts'),
    },
  },
});
