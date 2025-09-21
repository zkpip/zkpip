// ESM, strict TS. Deterministic envelopeId generation and canonical hashing.
import { createHash, randomBytes } from 'node:crypto';

export interface CanonicalInput {
  // Minimal canonical fields; extend as your schema evolves
  protocol: 'groth16' | 'plonk';
  curve: 'bn128';
  proof: unknown;
  publicSignals: readonly unknown[];
  adapterDescriptor?: {
    proofSystem: string;
    curve: string;
    prover: string;
  };
}

export type HexString = `0x${string}`;

export function sha256Hex(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex');
}

// Type guard for 0x-hex seeds
export function asHexSeed(seed: string): `0x${string}` {
  if (!/^0x[0-9a-f]+$/i.test(seed)) {
    throw new Error('seed must be 0x-prefixed hex');
  }
  return seed as `0x${string}`;
}

export function normalizeJsonStable<T>(obj: T): string {
  // Stable JSON stringify: sort object keys recursively
  const seen = new WeakSet();
  const sort = (val: unknown): unknown => {
    if (val === null) return null;
    if (Array.isArray(val)) return val.map(sort);
    if (typeof val === 'object') {
      if (seen.has(val as object)) {
        throw new Error('Circular reference in normalizeJsonStable');
      }
      seen.add(val as object);
      const entries = Object.entries(val as Record<string, unknown>).sort(([a], [b]) =>
        a.localeCompare(b),
      );
      return entries.reduce<Record<string, unknown>>((acc, [k, v]) => {
        acc[k] = sort(v);
        return acc;
      }, {});
    }
    return val;
  };
  return JSON.stringify(sort(obj));
}

export function deriveCanonicalHash(input: CanonicalInput): string {
  // Hash inputs as defined: result.proof + result.publicSignals + adapterDescriptor (no artifact paths/URIs).
  const payload = {
    proof: input.proof,
    publicSignals: input.publicSignals,
    adapterDescriptor: input.adapterDescriptor ?? null,
  };
  const stable = normalizeJsonStable(payload);
  return sha256Hex(stable);
}

export function makeEnvelopeId(seed?: HexString): string {
  // If seed provided, use sha256(seed) for deterministic id; else random 16 bytes
  const base = seed
    ? Buffer.from(seed.replace(/^0x/i, ''), 'hex')
    : randomBytes(16);
  return `env_${sha256Hex(base).slice(0, 32)}`;
}
