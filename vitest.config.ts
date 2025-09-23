import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  // Fallback aliasing for any project
  resolve: {
    alias: {
      '#fs-compat': path.resolve(__dirname, 'packages/cli/src/utils/fs-compat.ts'),
      '#paths': path.resolve(__dirname, 'packages/cli/src/utils/paths.ts'),
      '@zkpip/core': path.resolve(__dirname, 'packages/core/src/index.ts'),
    },
  },
  projects: [
    // Core
    defineConfig({
      test: {
        globals: true,
        include: ['packages/core/src/**/*.{test,e2e}.ts'],
      },
    }),
    // CLI
    defineConfig({
      test: {
        globals: true,
        include: ['packages/cli/src/**/*.{test,e2e}.ts'],
        exclude: ['packages/cli/src/**/__tests__/helpers/**', 'packages/cli/src/**/helpers/**'],
      },
    }),
  ],
});
