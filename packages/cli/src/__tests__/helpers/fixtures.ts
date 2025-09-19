// packages/cli/src/__tests__/helpers/fixtures.ts
import { existsSync } from 'node:fs';
import { fixturesPath } from './cliRunner.js';

/** Common fixture file paths (ESM-safe, no hard-coded __dirname). */
export const plonkValid   = fixturesPath('snarkjs-plonk/valid/verification.json');
export const plonkInvalid = fixturesPath('snarkjs-plonk/invalid/verification.json');

export const g16Valid     = fixturesPath('snarkjs-groth16/valid/verification.json');

export const zoValid      = fixturesPath('zokrates-groth16/valid/verification.json');

// Non-existent file for ENOENT checks (stable absolute path)
export const enoentPath   = fixturesPath('definitely-does-not-exist.json');

/** Existence flags for conditional tests. */
export const hasG16 = existsSync(g16Valid);
export const hasZo  = existsSync(zoValid);

/** Handy env blob for “fast path” runs (if you don't use runCliFast). */
export const FAST_ENV: Readonly<Record<string, string>> = {
  ZKPIP_FAST_RUNTIME: '1',
  ZKPIP_DEBUG: process.env.ZKPIP_DEBUG ?? '0',
};

/** Optional strict getter to fail early on typos. */
export function requireFixture(p: string): string {
  if (!existsSync(p)) {
    throw new Error(`Fixture not found: ${p}`);
  }
  return p;
}
