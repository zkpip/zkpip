// packages/cli/src/adapters/snarkjs-plonk.ts
// Strict, ESM-safe PLONK adapter on snarkjs.
// - Accepts dir triplet or inline object
// - Normalizes publics (hex -> dec) via auto-normalizer
// - Ensures proof is hex string
// - Dumps normalized inputs when enabled

import fss from 'node:fs';
import path from 'node:path';

import type { Adapter, VerifyOutcome } from '../registry/types.js';
import {
  isObj,
  get,
  getPath,
  deepFindFirst,
  deepFindByKeys,
  materializeInput,
  errorMessage,
  readFromArtifactRef,
  readJsonRelative,
  assertStringArray,
  coercePublics, // hex -> dec for publics
  autoNormalizeForAdapter, // shared normalizer entry
  type VerificationKey,
} from './_shared.js';
import { dumpNormalized } from '../utils/dumpNormalized.js';
import { getPlonkVerify } from './snarkjsRuntime.js';

type PlonkProof = string | Record<string, unknown>;

const ID = 'snarkjs-plonk' as const;

/* ----------------------------- small helpers ----------------------------- */

// Resolve ArtifactRef objects ({path|uri}) or JSON file paths into loaded values.
function resolveArtifactOrJson(src: unknown, baseDir?: string): unknown {
  if (isObj(src)) {
    const v = readFromArtifactRef(src, baseDir);
    return typeof v !== 'undefined' ? v : src;
  }
  if (typeof src === 'string') {
    const v = readJsonRelative(src, baseDir);
    return typeof v !== 'undefined' ? v : src;
  }
  return src;
}

function looksPlonkProof(p: unknown): p is PlonkProof {
  return (typeof p === 'string' && p.length > 0) || isObj(p);
}

function normalizeProofPlonk(p: unknown): PlonkProof | undefined {
  if (looksPlonkProof(p)) return p;

  const inner = isObj(p) ? (get(p, 'proof') ?? getPath(p, 'result.proof')) : undefined;
  if (looksPlonkProof(inner)) return inner;

  const deep = deepFindByKeys(p, ['proof']);
  return looksPlonkProof(deep) ? deep : undefined;
}

type ExtractedSpecific = {
  vkey?: VerificationKey;
  proof?: PlonkProof;
  publics?: ReadonlyArray<string | number | bigint>;
};

/** Dir triplet extractor with lenient filenames */
function extractFromDir(dir: string): ExtractedSpecific {
  const findFirstExisting = (candidates: ReadonlyArray<string>): string | undefined => {
    for (const name of candidates) {
      const p = path.join(dir, name);
      try {
        if (fss.existsSync(p) && fss.statSync(p).isFile()) return p;
      } catch {
        /* ignore */
      }
    }
    return undefined;
  };

  const readJsonIfExists = (file?: string): unknown => {
    if (!file) return undefined;
    try {
      const raw = fss.readFileSync(file, 'utf8');
      return JSON.parse(raw) as unknown;
    } catch {
      return undefined;
    }
  };

  const vkFile = findFirstExisting([
    'verification_key.json',
    'vk.json',
    'verification.key.json',
    'verification.key', // non-JSON → readJsonIfExists will return undefined
  ]);
  const proofFile = findFirstExisting(['proof.json', 'proof_valid.json']);
  const publicsFile = findFirstExisting([
    'public.json',
    'publics.json',
    'publicSignals.json',
    'inputs.json',
  ]);

  const vkeyRaw = readJsonIfExists(vkFile);
  const proofRaw = readJsonIfExists(proofFile);
  const publicsRaw = readJsonIfExists(publicsFile);

  const ex: ExtractedSpecific = {};

  if (isObj(vkeyRaw)) ex.vkey = vkeyRaw as VerificationKey;

  const pf = normalizeProofPlonk(proofRaw);
  if (pf) ex.proof = pf;

  if (Array.isArray(publicsRaw)) ex.publics = publicsRaw as ReadonlyArray<string | number | bigint>;
  else if (isObj(publicsRaw)) {
    const maybe = (get(publicsRaw, 'publicSignals') ??
      get(publicsRaw, 'publics') ??
      get(publicsRaw, 'inputs')) as unknown;
    if (Array.isArray(maybe)) ex.publics = maybe as ReadonlyArray<string | number | bigint>;
  }

  // If publics missing but proof.json embeds them
  if (!ex.publics && isObj(proofRaw)) {
    const maybe = (get(proofRaw, 'publicSignals') ?? get(proofRaw, 'inputs')) as unknown;
    if (Array.isArray(maybe)) ex.publics = maybe as ReadonlyArray<string | number | bigint>;
  }

  return ex;
}

/** Object extractor (inline JSON path) */
function extractFromObject(input: unknown, baseDir?: string): ExtractedSpecific {
  const out: ExtractedSpecific = {};

  // --- vkey candidates ---
  const vkCand =
    get(input, 'verificationKey') ??
    getPath(input, 'result.verificationKey') ??
    get(input, 'vkey') ??
    getPath(input, 'bundle.verificationKey') ??
    getPath(input, 'meta.verificationKey') ??
    getPath(input, 'artifacts.verificationKey') ??
    getPath(input, 'artifacts.vkey') ??
    getPath(input, 'verification.verificationKey') ??
    deepFindByKeys(input, ['verificationKey', 'vkey', 'vk', 'key']);

  if (vkCand != null) {
    const resolved = resolveArtifactOrJson(vkCand, baseDir);
    if (isObj(resolved)) out.vkey = resolved as VerificationKey;
  }

  // --- proof candidates (prefer hex string; accept {proof: string|object}) ---
  const prCand =
    get(input, 'proof') ??
    getPath(input, 'result.proof') ??
    getPath(input, 'bundle.proof') ??
    getPath(input, 'artifacts.proof') ??
    getPath(input, 'verification.proof') ??
    deepFindFirst(input, (v: unknown) => typeof v === 'string' || isObj(v));

  if (prCand != null) {
    const resolved = resolveArtifactOrJson(prCand, baseDir);
    const pf = normalizeProofPlonk(resolved);
    if (pf) out.proof = pf;
  }

  // --- publics candidates ---
  const psCand =
    get(input, 'publicSignals') ??
    get(input, 'publicInputs') ??
    get(input, 'inputs') ??
    get(input, 'public') ??
    getPath(input, 'result.publicSignals') ??
    getPath(input, 'bundle.publicSignals') ??
    getPath(input, 'artifacts.publicSignals') ??
    getPath(input, 'verification.publicSignals') ??
    deepFindByKeys(input, [
      'publicSignals',
      'public_inputs',
      'publicInputs',
      'inputs',
      'public',
      'publics',
    ]);

  if (psCand != null) {
    const resolved = resolveArtifactOrJson(psCand, baseDir);
    if (Array.isArray(resolved)) {
      out.publics = resolved as ReadonlyArray<string | number | bigint>;
    } else if (isObj(resolved)) {
      const arr = (get(resolved, 'publicSignals') ??
        get(resolved, 'publicInputs') ??
        get(resolved, 'inputs') ??
        get(resolved, 'public')) as unknown;
      if (Array.isArray(arr)) out.publics = arr as ReadonlyArray<string | number | bigint>;
    }
  }

  return out;
}

function looksSnarkjsPlonk(input: unknown): boolean {
  if (typeof input === 'string') return input.length > 0;
  if (!isObj(input)) return false;

  const psVal = (get(input, 'proofSystem') ?? getPath(input, 'meta.proofSystem')) as unknown;
  const fwVal = (get(input, 'framework') ?? getPath(input, 'meta.framework')) as unknown;

  const ps = typeof psVal === 'string' ? psVal.toLowerCase() : undefined;
  const fw = typeof fwVal === 'string' ? fwVal.toLowerCase() : undefined;

  if (ps === 'plonk') return true;
  if (fw === 'snarkjs') return true;

  const proofCandidate = get(input, 'proof') ?? getPath(input, 'result.proof');
  return !!normalizeProofPlonk(proofCandidate);
}

/* --------------------------------- adapter -------------------------------- */

export const snarkjsPlonk: Adapter = {
  id: ID,
  proofSystem: 'plonk',
  framework: 'snarkjs',

  canHandle(input: unknown): boolean {
    return typeof input === 'string' ? input.length > 0 : looksSnarkjsPlonk(input);
  },

  async verify(input: unknown): Promise<VerifyOutcome<typeof ID>> {
    try {
      const root = materializeInput(input);
      let exSpecific: ExtractedSpecific = {};
      let inputKind: 'dir' | 'file' | 'inline' | 'unknown' = 'unknown';

      if (typeof root === 'string') {
        try {
          const st = fss.statSync(root);
          if (st.isDirectory()) {
            exSpecific = extractFromDir(root);
            inputKind = 'dir';
          } else if (st.isFile()) {
            const baseDir = path.dirname(root);
            const doc = readJsonRelative(root, baseDir);
            if (isObj(doc)) {
              exSpecific = extractFromObject(doc as Record<string, unknown>, baseDir);
              inputKind = 'file';
            }
          }
        } catch {
          inputKind = 'unknown';
        }
      } else if (isObj(root)) {
        exSpecific = extractFromObject(root as Record<string, unknown>);
        inputKind = 'inline';
      } else {
        inputKind = 'unknown';
      }

      // Pre-extract meta dump (harmonized with Groth16 smoke)
      dumpNormalized(ID, { meta: { preExtract: true, inputKind } });

      const exCommon = {
        ...(exSpecific.vkey ? { vkey: exSpecific.vkey as Record<string, unknown> } : {}),
        ...(exSpecific.proof ? { proof: exSpecific.proof as unknown } : {}),
        ...(exSpecific.publics?.length ? { publics: coercePublics(exSpecific.publics) } : {}),
      } as const;

      const { value: exN, report } = autoNormalizeForAdapter(ID, exCommon);

      if (!exN.vkey || !exN.proof || !exN.publics?.length) {
        return {
          ok: false,
          adapter: ID,
          error: 'adapter_error',
          message: 'Missing vkey/proof/publicSignals for plonk',
        };
      }

      const vkeySnark = exN.vkey as Record<string, unknown>;
      const publicsDec = exN.publics;
      assertStringArray(publicsDec, 'publicSignals');

      // --- Proof extraction for snarkjs.plonk.verify ---
      // Accept either an object proof, or a nested { proof: object|string }, or a raw string.
      let proofForVerify: object | string | undefined;
      if (typeof exN.proof === 'string') {
        proofForVerify = exN.proof;
      } else if (isObj(exN.proof)) {
        const inner = get(exN.proof, 'proof') as unknown;
        if (typeof inner === 'string' || isObj(inner)) {
          proofForVerify = inner as object | string;
        } else {
          // some generators store the proof directly as an object
          proofForVerify = exN.proof as object;
        }
      }
      if (!(typeof proofForVerify === 'string' || isObj(proofForVerify))) {
        return {
          ok: false,
          adapter: ID,
          error: 'adapter_error',
          message: 'Invalid PLONK proof: expected object or hex string',
        };
      }

      // Optional sanity on vkey
      const proto = vkeySnark['protocol'] as unknown;
      if (proto && proto !== 'plonk') {
        return {
          ok: false,
          adapter: ID,
          error: 'adapter_error',
          message: `Unexpected protocol: ${String(proto)}`,
        };
      }
      const nPub = vkeySnark['nPublic'] as unknown;
      if (
        typeof nPub === 'number' &&
        Number.isFinite(nPub) &&
        nPub >= 0 &&
        nPub !== publicsDec.length
      ) {
        return {
          ok: false,
          adapter: ID,
          error: 'adapter_error',
          message: `Invalid nPublic: expected ${publicsDec.length}, got ${nPub}`,
        };
      }

      // Dump normalized (proof type is useful in meta)
      dumpNormalized(ID, {
        vkey: vkeySnark,
        proof: proofForVerify,
        publics: publicsDec,
        meta: {
          publics: publicsDec.length,
          proofType: typeof proofForVerify,
          actions: report.actions ?? [],
        },
      });

      // Verify via snarkjs
      const verifyPlonk = await getPlonkVerify();
      const ok = await verifyPlonk(vkeySnark as object, publicsDec, proofForVerify);
      return ok
        ? { ok: true, adapter: ID }
        : { ok: false, adapter: ID, error: 'verification_failed' as const };
    } catch (err: unknown) {
      const msg = errorMessage(err);
      return msg
        ? { ok: false, adapter: ID, error: 'adapter_error', message: msg }
        : { ok: false, adapter: ID, error: 'adapter_error' };
    }
  },
};
