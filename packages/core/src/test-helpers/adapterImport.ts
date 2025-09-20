// packages/core/src/test-helpers/adapterImport.ts
// Centralized utilities to import CLI adapters and resolve the extractTriplet function.
// - English comments
// - No `any` used
// - ESM compatible

import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export type ExtractedTriplet = {
  verificationKey: Record<string, unknown>;
  proof: unknown;
  publics: readonly string[];
};

export type ExtractFn = (input: unknown) => ExtractedTriplet;

/** Adapter module name literals available in the CLI package. */
export type AdapterName = 'snarkjs-groth16' | 'snarkjs-plonk' | 'zokrates-groth16';

/**
 * Dynamically import a CLI adapter module from either TS source or built JS.
 * This is robust in local dev (TS) and CI (dist).
 */
export async function importCliAdapter(name: AdapterName): Promise<Record<string, unknown>> {
  const candidates = [
    // TS source (dev)
    resolve(__dirname, `../../../cli/src/adapters/${name}.ts`),
    // Built JS (CI)
    resolve(__dirname, `../../../cli/dist/adapters/${name}.js`),
  ];

  let lastErr: unknown;
  for (const p of candidates) {
    try {
      return await import(pathToFileURL(p).href);
    } catch (e) {
      lastErr = e;
    }
  }

  if (lastErr instanceof Error) throw lastErr;
  throw new Error(`Failed to import CLI adapter: ${name}`);
}

/**
 * Resolve an extractTriplet function from various export shapes.
 * Supports:
 *  - named export:   export function extractTriplet(...)
 *  - default object: export default { extractTriplet, ... }
 *  - legacy names:   export const extract = ...
 *  - default fn:     export default function extractTriplet(...)
 */
export function resolveExtract(mod: Record<string, unknown>): ExtractFn | undefined {
  const candidates: unknown[] = [
    mod['extractTriplet'],
    (mod['default'] as Record<string, unknown> | undefined)?.['extractTriplet'],
    (mod['adapter'] as Record<string, unknown> | undefined)?.['extractTriplet'],
    mod['extract'], // legacy
    (mod['default'] as Record<string, unknown> | undefined)?.['extract'],
    typeof mod['default'] === 'function' ? (mod['default'] as unknown) : undefined,
  ];

  for (const c of candidates) {
    if (typeof c === 'function') {
      // Narrow to our expected signature at the boundary
      return c as ExtractFn;
    }
  }
  return undefined;
}
