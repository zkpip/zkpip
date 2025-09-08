import { plonk } from 'snarkjs';
import type { Adapter, DetectInput } from '../registry/types.js';

function isString(x: unknown): x is string {
  return typeof x === 'string';
}
function isPublicSignals(x: unknown): x is ReadonlyArray<string | number | bigint> {
  return Array.isArray(x) && x.every((v) => ['string', 'number', 'bigint'].includes(typeof v));
}

function pick<V>(primary: V | undefined, ...alts: Array<V | undefined>): V | undefined {
  return primary !== undefined ? primary : alts.find((v) => v !== undefined);
}

function extractPlonkPieces(input: DetectInput): {
  vkey: unknown;
  publicSignals: ReadonlyArray<string | number | bigint>;
  proof: unknown;
} | null {
  const maybeVkey =
    (input as Record<string, unknown>)['verificationKey'] ??
    (input as Record<string, unknown>)['vkey'] ??
    (input.meta as Record<string, unknown> | undefined)?.['verificationKey'];

  const maybeSignals = pick(
    (input as Record<string, unknown>)['publicInputs'] as unknown,
    (input as Record<string, unknown>)['publicSignals'] as unknown,
    (input.meta as Record<string, unknown> | undefined)?.['publicInputs'] as unknown,
  );

  const maybeProof =
    (input as Record<string, unknown>)['proof'] ??
    (input.meta as Record<string, unknown> | undefined)?.['proof'];

  if (!maybeVkey || !maybeProof || !isPublicSignals(maybeSignals)) return null;

  return { vkey: maybeVkey, publicSignals: maybeSignals, proof: maybeProof };
}

export const snarkjsPlonk: Adapter = {
  id: 'snarkjs-plonk',
  proofSystem: 'plonk',
  framework: 'snarkjs',

  canHandle(bundle: DetectInput): boolean {
    const ps =
      (isString(bundle.proofSystem) && bundle.proofSystem) ||
      (isString(bundle.meta?.proofSystem) && bundle.meta!.proofSystem) ||
      '';
    const fw =
      (isString(bundle.framework) && bundle.framework) ||
      (isString(bundle.meta?.framework) && bundle.meta!.framework) ||
      '';

    if (ps.toLowerCase() === 'plonk' && fw.toLowerCase() === 'snarkjs') return true;

    return extractPlonkPieces(bundle) !== null;
  },

  async verify(bundle: DetectInput) {
    const parts = extractPlonkPieces(bundle);
    if (!parts) {
      return { ok: false, adapter: this.id, error: 'invalid_input' };
    }

    try {
      const ok = await plonk.verify(parts.vkey, parts.publicSignals, parts.proof);
      return ok
        ? { ok: true, adapter: this.id }
        : { ok: false, adapter: this.id, error: 'verification_failed' };
    } catch {
      return {
        ok: false,
        adapter: this.id,
        error: 'exception_during_verify',
      };
    }
  },
};
