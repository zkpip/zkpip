import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
  },
  resolve: {
    alias: {
      // Point to source for dev DX; switch to dist when publishing
      '@zkpip/core': path.resolve(__dirname, '../core/src/index.ts'),
      '@zkpip/adapters-groth16': path.resolve(__dirname, '../adapters/groth16/src/index.ts'),
      '@zkpip/adapters-plonk': path.resolve(__dirname, '../adapters/plonk/src/index.ts'),
      '@zkpip/adapters-stark': path.resolve(__dirname, '../adapters/stark/src/index.ts'),
    },
  },
});
