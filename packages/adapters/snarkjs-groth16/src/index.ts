// packages/adapters/snarkjs-groth16/src/index.ts
// ZKPIP adapter for snarkjs + Groth16 (ESM, strict TS, no `any`).
// Comments in English for OSS clarity.

import type { Adapter, JsonValue, ProofEnvelopeV1, PublicValue } from '@zkpip/adapters-core';
import { isProofEnvelopeV1 } from '@zkpip/adapters-core';

/** Stable, globally unique adapter id. */
export const ID = 'snarkjs-groth16';

/** Minimal provider surface that we use from snarkjs. */
export interface Groth16Provider {
  verify(vkey: JsonValue, publics: readonly PublicValue[], proof: JsonValue): Promise<boolean>;
}

/**
 * Default runtime loader for snarkjs.groth16.
 * Uses dynamic import to keep snarkjs as a peer dep and avoid bundling.
 */
async function defaultLoadProvider(): Promise<Groth16Provider> {
  // Dynamic import with narrow type refinement (no `any`).
  const mod = await import('snarkjs').catch(() => {
    throw new Error('zkpip/snarkjs_missing');
  });

  // Narrow the imported module and defend against unexpected shapes.
  const maybeGroth16 = (mod as { readonly groth16?: unknown }).groth16;
  if (
    typeof maybeGroth16 !== 'object' ||
    maybeGroth16 === null ||
    typeof (maybeGroth16 as { verify?: unknown }).verify !== 'function'
  ) {
    throw new Error('zkpip/snarkjs_groth16_invalid_shape');
  }

  const g = maybeGroth16 as { verify: (v: unknown, p: unknown, pr: unknown) => unknown };

  // Wrap into our minimal provider interface.
  return {
    async verify(vkey, publics, proof): Promise<boolean> {
      // snarkjs accepts string/number publics; bigint also common in apps.
      const res = await g.verify(vkey, publics as unknown, proof);
      return res === true;
    },
  };
}

/**
 * Create a snarkjs-groth16 adapter.
 * The provider loader is injectable for unit tests (mocking without patching ESM imports).
 */
export function createSnarkjsGroth16Adapter(
  loadProvider: () => Promise<Groth16Provider> = defaultLoadProvider,
): Adapter {
  return {
    id: ID,

    canHandle(input: unknown): boolean {
      // 1) Already a canonical envelope?
      if (isProofEnvelopeV1(input)) {
        return input.proofSystem === 'groth16' && input.framework === 'snarkjs';
      }

      // 2) Heuristic shape checks for common snarkjs inputs.
      if (!isObject(input)) return false;

      // vkey markers
      const hasVKey =
        hasKey(input, 'verificationKey') || hasKey(input, 'vk') || hasKey(input, 'vkey');

      // proof markers (either nested proof or raw pi_a/pi_b/pi_c)
      const hasProof =
        hasKey(input, 'proof') ||
        (hasKey(input, 'pi_a') && hasKey(input, 'pi_b') && hasKey(input, 'pi_c'));

      // publics markers
      const hasPublics =
        hasKey(input, 'publicSignals') ||
        hasKey(input, 'publics') ||
        hasKey(input, 'inputs') ||
        hasKey(input, 'public');

      return Boolean(hasVKey && hasProof && hasPublics);
    },

    toEnvelope(input: unknown): ProofEnvelopeV1 {
      if (isProofEnvelopeV1(input)) {
        // Already canonical – return as-is (defensive copy not necessary for now).
        return input;
      }
      if (!isObject(input)) {
        throw new Error('zkpip/input_not_object');
      }

      // Extract fields with tolerant key set.
      const vkey =
        (input as Record<string, unknown>)['verificationKey'] ??
        (input as Record<string, unknown>)['vk'] ??
        (input as Record<string, unknown>)['vkey'];

      const proofRaw = (input as Record<string, unknown>)['proof'] ?? makeProofIfSplit(input);

      const publicsRaw =
        (input as Record<string, unknown>)['publicSignals'] ??
        (input as Record<string, unknown>)['publics'] ??
        (input as Record<string, unknown>)['inputs'] ??
        (input as Record<string, unknown>)['public'];

      if (
        typeof vkey === 'undefined' ||
        typeof proofRaw === 'undefined' ||
        typeof publicsRaw === 'undefined'
      ) {
        throw new Error('zkpip/normalize_missing_fields');
      }

      const publicsArr = normalizePublics(publicsRaw);
      if (publicsArr.length === 0) {
        throw new Error('zkpip/publics_empty');
      }

      return {
        version: 1,
        proofSystem: 'groth16',
        framework: 'snarkjs',
        vkey: vkey as JsonValue,
        proof: proofRaw as JsonValue,
        publics: publicsArr,
        meta: { source: 'snarkjs' },
      };
    },

    async verify(input: unknown): Promise<boolean> {
      const env = isProofEnvelopeV1(input) ? input : this.toEnvelope(input);
      if (env.proofSystem !== 'groth16' || env.framework !== 'snarkjs') {
        // Not this adapter's domain
        return false;
      }
      const provider = await loadProvider();
      return provider.verify(env.vkey, env.publics, env.proof);
    },
  };
}

/** Default instance used by consumers (CLI, apps). */
export const snarkjsGroth16Adapter: Adapter = createSnarkjsGroth16Adapter();

/* --------------------------------- utils ---------------------------------- */

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

function hasKey(o: Record<string, unknown>, k: string): boolean {
  return Object.prototype.hasOwnProperty.call(o, k);
}

/** If proof is given as split pi_a/pi_b/pi_c on the root, wrap it as { pi_a, pi_b, pi_c }. */
function makeProofIfSplit(o: Record<string, unknown>): unknown | undefined {
  const pa = o['pi_a'];
  const pb = o['pi_b'];
  const pc = o['pi_c'];
  if (typeof pa !== 'undefined' && typeof pb !== 'undefined' && typeof pc !== 'undefined') {
    return { pi_a: pa, pi_b: pb, pi_c: pc };
  }
  return undefined;
}

/** Normalize publics from various shapes into `readonly PublicValue[]`. */
function normalizePublics(x: unknown): readonly PublicValue[] {
  if (Array.isArray(x)) {
    return x.filter(isPublicValue);
  }
  // Some tools wrap publics: { signals: [...] } or { public: [...] }
  if (isObject(x)) {
    for (const k of ['signals', 'public', 'publics', 'inputs']) {
      const maybe = (x as Record<string, unknown>)[k];
      if (Array.isArray(maybe)) {
        return maybe.filter(isPublicValue);
      }
    }
  }
  return [];
}

function isPublicValue(v: unknown): v is PublicValue {
  const t = typeof v;
  return t === 'string' || t === 'number' || t === 'bigint';
}
