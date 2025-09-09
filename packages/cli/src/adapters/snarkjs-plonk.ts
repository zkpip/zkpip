// Strict, ESM-safe PLONK adapter using shared utils.
// - Supports directory triplet: verification_key.json + proof.json + public.json
// - Respects exactOptionalPropertyTypes (message only if non-empty)

import fs from 'node:fs/promises';
import fss from 'node:fs';
import path from 'node:path';
import * as snarkjs from 'snarkjs';
import type { Adapter, VerifyOutcome } from '../registry/types.js';
import {
  isObj, get, getPath,
  deepFindFirst, deepFindByKeys,
  normalizePublicSignals, materializeInput, errorMessage,
  PublicSignal,
} from './_shared.js';

const { plonk } = snarkjs;

type VerificationKey = Record<string, unknown>;

// In snarkjs PLONK, the proof persisted by `plonk.prove` is a hex string (e.g., "0x...").
type PlonkProof = string | Record<string, unknown>;

function looksPlonkProof(p: unknown): p is PlonkProof {
  // Accept hex string OR non-null object (snarkjs PLONK proof is an object in CLI output)
  return (typeof p === 'string' && p.length > 0) || isObj(p);
}

function normalizeProofPlonk(p: unknown): PlonkProof | undefined {
  if (looksPlonkProof(p)) return p;

  const inner = isObj(p) ? (get(p, 'proof') ?? getPath(p, 'result.proof')) : undefined;
  if (looksPlonkProof(inner)) return inner;

  const deep = deepFindByKeys(p, ['proof']);
  return looksPlonkProof(deep) ? deep : undefined;
}

type Extracted = {
  vkey?: VerificationKey;
  proof?: PlonkProof;
  publics?: ReadonlyArray<PublicSignal>;
};

// -- NEW: directory triplet support -------------------------------------------------
async function tryLoadTripletFromDir(maybeDir: unknown): Promise<Extracted | undefined> {
  if (typeof maybeDir !== 'string' || maybeDir.length === 0) return undefined;
  // Fast path: avoid throwing in common non-dir cases
  try {
    const st = fss.existsSync(maybeDir) ? fss.statSync(maybeDir) : undefined;
    if (!st || !st.isDirectory()) return undefined;
  } catch {
    return undefined;
  }

  const vkPath = path.join(maybeDir, 'verification_key.json');
  const proofPath = path.join(maybeDir, 'proof.json');
  const publicPath = path.join(maybeDir, 'public.json');

  const out: Extracted = {};
  try {
    const [vkRaw, proofRaw, publicRaw] = await Promise.all([
      fs.readFile(vkPath, 'utf8').catch(() => undefined),
      fs.readFile(proofPath, 'utf8').catch(() => undefined),
      fs.readFile(publicPath, 'utf8').catch(() => undefined),
    ]);

    if (vkRaw) {
      const vk = JSON.parse(vkRaw) as unknown;
      if (isObj(vk)) out.vkey = vk as VerificationKey;
    }

    if (proofRaw) {
      const pr = JSON.parse(proofRaw) as unknown;
      const pf = normalizeProofPlonk(pr);
      if (pf) out.proof = pf;
    }

    if (publicRaw) {
      const pub = JSON.parse(publicRaw) as unknown;
      const ps = normalizePublicSignals(pub);
      if (ps.length > 0) out.publics = ps;
    }
  } catch {
    // swallow; fall back to object extraction
  }

  if (out.vkey || out.proof || out.publics) return out;
  return undefined;
}

// -- Existing object-extraction path ------------------------------------------------
function extractFromObject(input: unknown): Extracted {
  const out: Extracted = {};

  // 1) Common top-level placements
  const vkeyTop = get(input, 'verificationKey');
  if (isObj(vkeyTop)) out.vkey = vkeyTop;

  const res = get(input, 'result');
  if (isObj(res)) {
    const pf = normalizeProofPlonk(get(res, 'proof'));
    if (pf) out.proof = pf;

    const ps = normalizePublicSignals(get(res, 'publicSignals') ?? get(res, 'public_inputs'));
    if (ps.length > 0) out.publics = ps;
  }

  // 2) Fallback (alternative nests)
  if (!out.vkey) {
    const cand =
      getPath(input, 'result.verificationKey') ??
      get(input, 'vkey') ??
      getPath(input, 'bundle.verificationKey') ??
      getPath(input, 'meta.verificationKey') ??
      getPath(input, 'artifacts.verificationKey') ??
      getPath(input, 'artifacts.vkey') ??
      getPath(input, 'verification.verificationKey') ??
      deepFindByKeys(input, ['verificationKey', 'vkey', 'vk', 'key']);
    if (isObj(cand)) out.vkey = cand as VerificationKey;
  }

  if (!out.proof) {
    const cand =
      getPath(input, 'bundle.proof') ??
      getPath(input, 'artifacts.proof') ??
      getPath(input, 'verification.proof') ??
      deepFindFirst(input, looksPlonkProof);
    const pf = normalizeProofPlonk(cand);
    if (pf) out.proof = pf;
  }

  if (!out.publics || out.publics.length === 0) {
    let ps = normalizePublicSignals(
      getPath(input, 'bundle.publicSignals') ??
      getPath(input, 'artifacts.publicSignals') ??
      getPath(input, 'verification.publicSignals') ??
      get(input, 'publicSignals') ??
      get(input, 'publicInputs') ??
      get(input, 'inputs')
    );
    if (ps.length === 0) {
      ps = normalizePublicSignals(deepFindByKeys(input, ['publicSignals', 'public_inputs', 'publicInputs', 'inputs']));
    }
    if (ps.length > 0) out.publics = ps;
  }

  return out;
}

function looksSnarkjsPlonk(input: unknown): boolean {
  if (!isObj(input)) {
    // Allow any non-empty string (path to dir or .json, or inline JSON-ish)
    return typeof input === 'string' && input.length > 0;
  }
  const ps = (get<string>(input, 'proofSystem') ?? getPath(input, 'meta.proofSystem')) as string | undefined;
  const fw = (get<string>(input, 'framework') ?? getPath(input, 'meta.framework')) as string | undefined;
  if (typeof ps === 'string' && ps.toLowerCase() === 'plonk') return true;
  if (typeof fw === 'string' && fw.toLowerCase() === 'snarkjs') return true;
  const proof = normalizeProofPlonk(get(input, 'proof') ?? getPath(input, 'result.proof'));
  return !!proof;
}

const ID = 'snarkjs-plonk' as const;

export const snarkjsPlonk: Adapter = {
  id: ID,
  proofSystem: 'plonk',
  framework: 'snarkjs',

  canHandle(input: unknown): boolean {
    // Be permissive: directory path, .json path, or object with PLONK/snarkjs markers
    if (typeof input === 'string') return input.length > 0;
    return looksSnarkjsPlonk(input);
  },

  async verify(input: unknown): Promise<VerifyOutcome<typeof ID>> {
    try {
      // 1) Directory fast-path
      if (typeof input === 'string' && input.length > 0) {
        try {
          const st = fss.statSync(input);
          if (st.isDirectory()) {
            const vkPath = path.join(input, 'verification_key.json');
            const proofPath = path.join(input, 'proof.json');
            const publicPath = path.join(input, 'public.json');

            const [vkRaw, proofRaw, publicRaw] = await Promise.all([
              fs.readFile(vkPath, 'utf8'),
              fs.readFile(proofPath, 'utf8'),
              fs.readFile(publicPath, 'utf8'),
            ]);

            const vkey = JSON.parse(vkRaw) as unknown;
            const proofParsed = JSON.parse(proofRaw) as unknown;
            const proof = normalizeProofPlonk(proofParsed);
            const publics = normalizePublicSignals(JSON.parse(publicRaw) as unknown);

            if (isObj(vkey) && proof && publics.length > 0) {
              const ok = await plonk.verify(vkey as VerificationKey, publics, proof);
              return ok ? { ok: true, adapter: ID } : { ok: false, adapter: ID, error: 'verification_failed' };
            }

            return {
              ok: false,
              adapter: ID,
              error: 'adapter_error',
              message: 'Missing vkey/proof/publicSignals for plonk (dir triplet)',
            };
          }
        } catch {
          /* not a dir → fall through */
        }
      }

      const root = materializeInput(input);
      const ex = extractFromObject(root); 

      if (!ex.vkey || !ex.proof || !ex.publics?.length) {
        return { ok: false, adapter: ID, error: 'adapter_error', message: 'Missing vkey/proof/publicSignals for plonk' };
      }

      const ok = await plonk.verify(ex.vkey, ex.publics, ex.proof);
      return ok ? { ok: true, adapter: ID } : { ok: false, adapter: ID, error: 'verification_failed' };
    } catch (err: unknown) {
      const msg = errorMessage(err);
      return msg
        ? { ok: false, adapter: ID, error: 'adapter_error', message: msg }
        : { ok: false, adapter: ID, error: 'adapter_error' };
    }
  } 
};
