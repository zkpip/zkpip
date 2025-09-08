// Minimal, ESM-only adapter wired to the new bundleLoader.
// No "any", exactOptionalPropertyTypes-safe, NodeNext + .js endings.

import * as snarkjs from 'snarkjs';
import { loadForVerify } from '../lib/loaders/bundlerLoader.js';

export const id = 'snarkjs-groth16' as const;
export const proofSystem = 'groth16' as const;
export const framework = 'snarkjs' as const;

export type VerifyOutcome =
  | { ok: true; adapter: typeof id }
  | { ok: false; adapter: typeof id; error: 'verification_failed' | 'adapter_error'; message?: string };

/** Narrow type for the specific verify function signature we use. */
type SnarkjsVerifyFn = (
  vkey: unknown,
  publicSignals: ReadonlyArray<string>, // normalized by loader (decimal strings)
  proof: unknown
) => Promise<boolean> | boolean;

/** Resolve the verify function from snarkjs in a typed, CJS-safe way. */
function getVerifyFn(): SnarkjsVerifyFn {
  const v = (snarkjs as unknown as { groth16: { verify: SnarkjsVerifyFn } }).groth16.verify;
  return v;
}

/** Low-level boolean – handy for unit tests. */
export async function verifyBundle(bundlePath: string): Promise<boolean> {
  const { vkey, proof, publicSignals } = await loadForVerify(bundlePath);
  const verifyFn = getVerifyFn();
  const res = await Promise.resolve(verifyFn(vkey as unknown, publicSignals, proof as unknown));
  return res === true;
}

/** High-level adapter entry used by the CLI command. */
export async function verify(bundlePath: string): Promise<VerifyOutcome> {
  try {
    const ok = await verifyBundle(bundlePath);
    return ok
      ? { ok: true, adapter: id }
      : { ok: false, adapter: id, error: 'verification_failed' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, adapter: id, error: 'adapter_error', message: msg };
  }
}
