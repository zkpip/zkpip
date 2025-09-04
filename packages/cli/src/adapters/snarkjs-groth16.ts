import fs from 'node:fs';
import path from 'node:path';
import * as snarkjs from 'snarkjs';
import type { Adapter } from '../registry/types.js';

// ---- minimal type model for snarkjs.groth16 we actually use ------------
type Groth16 = {
  verify(vkey: unknown, publicSignals: unknown, proof: unknown): Promise<boolean>;
};
const groth16: Groth16 = (snarkjs as unknown as { groth16: Groth16 }).groth16;

// ---- narrow helpers (no any) --------------------------------------------
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readStr(x: unknown): string {
  return (x ?? '').toString();
}
function readLower(x: unknown): string {
  return readStr(x).toLowerCase();
}

/**
 * Biztonságos, laza lekérés több elérési útból (pl. "meta.proof").
 * Ha bármelyik útvonalon értelmes (nem null/undefined) érték található, visszaadja.
 */
function getField<T>(obj: unknown, paths: string[]): T | undefined {
  for (const p of paths) {
    const segs = p.split('.');
    let cur: unknown = obj;
    for (const key of segs) {
      if (!isObject(cur)) {
        cur = undefined;
        break;
      }
      cur = cur[key];
      if (cur === undefined) break;
    }
    if (cur !== undefined && cur !== null) return cur as T;
  }
  return undefined;
}

function ensureArray<T>(x: unknown): T[] {
  if (Array.isArray(x)) return x as T[];
  if (x === undefined || x === null) return [];
  return [x as T];
}

/**
 * snarkjs-hez normalizáljuk a public signal-okat stringgé:
 * - bigint → decimális string
 * - number → egészre vágott decimális string
 * - hex (0x...) → BigInt → decimális string
 * - minden más → String(v)
 */
function normalizeSignals(arr: unknown[]): string[] {
  return arr.map((v) => {
    if (typeof v === 'bigint') return v.toString(10);
    if (typeof v === 'number') return Math.trunc(v).toString(10);
    const s = String(v);
    if (/^0x[0-9a-f]+$/i.test(s)) return BigInt(s).toString(10);
    return s;
  });
}

/**
 * Ha a bemenet string és JSON literálnak tűnik → JSON.parse.
 * Ha string és fájlútvonal → beolvas és parse.
 * Egyébként visszaadja az értéket változatlanul.
 */
async function loadJsonMaybeFile(inputDir: string, valueOrPath: unknown): Promise<unknown> {
  if (typeof valueOrPath === 'string') {
    const p = valueOrPath.trim();
    if (p.startsWith('{') || p.startsWith('[')) return JSON.parse(p);
    const abs = path.isAbsolute(p) ? p : path.resolve(inputDir, p);
    const txt = fs.readFileSync(abs, 'utf8');
    return JSON.parse(txt);
  }
  return valueOrPath;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// ---- bundle alak (laza, de típusos) -------------------------------------
type BundleLike = {
  proofSystem?: string;
  framework?: string;
  system?: string;
  provingScheme?: string;
  tool?: string;
  library?: string;
  publicSignals?: unknown;
  publicInputs?: unknown;
  verificationKey?: unknown;
  vkey?: unknown;
  vk?: unknown;
  proof?: unknown;
  groth16Proof?: unknown;
  meta?: {
    proofSystem?: string;
    framework?: string;
    publicSignals?: unknown;
    publicInputs?: unknown;
    verificationKey?: unknown;
    vkey?: unknown;
    vk?: unknown;
    proof?: unknown;
    groth16Proof?: unknown;
  };
};

// ---- adapter --------------------------------------------------------------
export const snarkjsGroth16: Adapter = {
  id: 'snarkjs-groth16',
  proofSystem: 'Groth16',
  framework: 'snarkjs',

  canHandle(bundle: unknown): boolean {
    const b = bundle as BundleLike;

    const ps =
      getField<string>(b, ['proofSystem', 'meta.proofSystem', 'system', 'provingScheme']) ?? '';
    const fw =
      getField<string>(b, ['framework', 'meta.framework', 'tool', 'library', 'prover.name']) ?? '';

    const psL = readLower(ps);
    const fwL = readLower(fw);

    const isGroth = psL.includes('groth') || psL === 'g16' || psL === 'groth16';
    const isSnarkjs = fwL.includes('snarkjs') || fwL.includes('circom') || fwL.includes('zkey');

    const hasProof =
      getField<unknown>(b, ['proof', 'groth16Proof', 'meta.proof', 'meta.groth16Proof']) !==
      undefined;
    const hasPublic =
      getField<unknown>(b, [
        'publicSignals',
        'publicInputs',
        'meta.publicSignals',
        'meta.publicInputs',
      ]) !== undefined;
    const hasVkey =
      getField<unknown>(b, [
        'verificationKey',
        'vkey',
        'vk',
        'meta.verificationKey',
        'meta.vkey',
        'meta.vk',
      ]) !== undefined;

    return (isGroth && isSnarkjs) || (hasProof && hasPublic && hasVkey);
  },

  async verify(bundle: unknown) {
    try {
      const b = bundle as BundleLike;
      const baseDir = process.cwd();

      // verification key
      const vkeyCandidate = getField<unknown>(b, [
        'verificationKey',
        'vkey',
        'vk',
        'meta.verificationKey',
        'meta.vkey',
        'meta.vk',
      ]);
      if (vkeyCandidate === undefined) {
        return { ok: false, adapter: this.id, error: 'missing_verification_key' };
      }
      const vkey = await loadJsonMaybeFile(baseDir, vkeyCandidate);

      // proof
      const proofCandidate = getField<unknown>(b, [
        'proof',
        'groth16Proof',
        'meta.proof',
        'meta.groth16Proof',
      ]);
      if (proofCandidate === undefined) {
        return { ok: false, adapter: this.id, error: 'missing_proof' };
      }
      const proof = await loadJsonMaybeFile(baseDir, proofCandidate);

      // public signals / inputs
      const publicCandidate =
        getField<unknown>(b, [
          'publicSignals',
          'publicInputs',
          'meta.publicSignals',
          'meta.publicInputs',
        ]) ?? [];
      const publicSignals = normalizeSignals(ensureArray<unknown>(publicCandidate));

      const ok = await groth16.verify(vkey, publicSignals, proof);
      return ok
        ? { ok: true, adapter: this.id }
        : { ok: false, adapter: this.id, error: 'verification_failed' };
    } catch (err: unknown) {
      return { ok: false, adapter: this.id, error: errorMessage(err) };
    }
  },
};
