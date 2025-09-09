// packages/cli/src/adapters/snarkjs-groth16.ts
import * as snarkjs from 'snarkjs';
import type { Adapter, VerifyOutcome } from '../registry/types.js';
import {
  isObj, get, getPath,
  deepFindFirst, deepFindByKeys, 
  parseJsonIfString, normalizePublicSignals,
  materializeInput, errorMessage,
  PublicSignal
} from './_shared.js';

const { groth16 } = snarkjs;

/* ----------------------------- JSON typings ----------------------------- */
type JsonPrimitive = string | number | boolean | null;
type Json = JsonPrimitive | Json[] | JsonObject;
type JsonObject = { [k: string]: Json };

/* ------------------------ Groth16 minimal typings ----------------------- */
type Groth16Proof = {
  readonly pi_a: readonly Json[];
  readonly pi_b: readonly Json[][];
  readonly pi_c: readonly Json[];
};
type VerificationKey = JsonObject;

/* -------------------------- structure detectors ------------------------- */
function looksGroth16Proof(p: unknown): p is Groth16Proof {
  if (!isObj(p)) return false;
  const a = get<readonly Json[]>(p, 'pi_a');
  const b = get<readonly Json[][]>(p, 'pi_b');
  const c = get<readonly Json[]>(p, 'pi_c');
  return Array.isArray(a) && Array.isArray(b) && Array.isArray(c);
}

type ProofWithParents = { proof: Groth16Proof; parents: ReadonlyArray<Record<string, unknown>> };

/* ----------------------------- extraction ------------------------------ */
type Extracted = {
  vkey?: VerificationKey;
  proof?: Groth16Proof;
  publics?: ReadonlyArray<PublicSignal>;
};

function normalizeProof(p: unknown): Groth16Proof | undefined {
  // accept stringified JSON
  const val = parseJsonIfString(p);

  if (looksGroth16Proof(val)) return val as Groth16Proof;

  // common nesting: { proof: {...} } vagy result.proof
  const inner = isObj(val) ? (get(val, 'proof') ?? getPath(val, 'result.proof')) : undefined;
  if (looksGroth16Proof(inner)) return inner as Groth16Proof;

  // deep fallback
  const deep = deepFindFirst(val, looksGroth16Proof);
  return looksGroth16Proof(deep) ? (deep as Groth16Proof) : undefined;
}

function extractFrom(input: unknown): Extracted {
  const out: Extracted = {};

  // --- 1) Direkt, a diagnosztika alapján ---
  // vkey: top-level "verificationKey"
  const vkeyTop = get(input, 'verificationKey');
  if (isObj(vkeyTop)) {
    out.vkey = vkeyTop as VerificationKey;
  } else {
    // string → próbáld JSON-ként
    const parsed = parseJsonIfString(vkeyTop);
    if (isObj(parsed)) out.vkey = parsed as VerificationKey;
  }

  // result.*
  const resultObj = get(input, 'result');
  if (isObj(resultObj)) {
    // proof: result.proof (vagy result.proof.proof)
    const proofDirect = get(resultObj, 'proof') ?? getPath(resultObj, 'proof.proof');
    const proofNorm = normalizeProof(proofDirect);
    if (proofNorm) out.proof = proofNorm;

    // publics: result.publicSignals
    const publicsRaw = get(resultObj, 'publicSignals') ?? get(resultObj, 'public_inputs');
    const publics = normalizePublicSignals(publicsRaw);
    if (publics.length > 0) out.publics = publics;
  }

  // --- 2) Gyors fallback a korábbi helyekre, ha bármi hiányzik ---
  if (!out.proof) {
    const altProof =
      getPath(input, 'bundle.proof') ??
      getPath(input, 'artifacts.proof') ??
      getPath(input, 'verification.proof') ??
      deepFindFirst(input, looksGroth16Proof);
    const norm = normalizeProof(altProof);
    if (norm) out.proof = norm;
  }

  if (!out.vkey) {
    const vkeyDirect =
      getPath(input, 'result.verificationKey') ??
      get(input, 'vkey') ??
      getPath(input, 'bundle.verificationKey') ??
      getPath(input, 'meta.verificationKey') ??
      getPath(input, 'artifacts.verificationKey') ??
      getPath(input, 'artifacts.vkey') ??
      getPath(input, 'verification.verificationKey') ??
      deepFindByKeys(input, ['verificationKey', 'vkey', 'vk', 'key']) ??
      deepFindFirst(input, (n) => isObj(n) && Array.isArray((n as { IC?: unknown }).IC as unknown[]));

    const parsed = parseJsonIfString(vkeyDirect);
    if (isObj(parsed)) out.vkey = parsed as VerificationKey;
    else if (isObj(vkeyDirect)) out.vkey = vkeyDirect as VerificationKey;
  }

  if (!out.publics || out.publics.length === 0) {
    let publics =
      normalizePublicSignals(
        getPath(input, 'bundle.publicSignals') ??
          getPath(input, 'artifacts.publicSignals') ??
          getPath(input, 'verification.publicSignals') ??
          get(input, 'publicSignals') ??
          get(input, 'publicInputs') ??
          get(input, 'inputs')
      );

    if (publics.length === 0) {
      const deepArray = deepFindByKeys(input, ['publicSignals', 'public_inputs', 'publicInputs', 'inputs']);
      publics = normalizePublicSignals(deepArray);
    }
    if (publics.length > 0) out.publics = publics;
  }

  return out;
}

/* ------------------------------ heuristics ----------------------------- */
function looksSnarkjsGroth16(input: unknown): boolean {
  if (!isObj(input)) return false;
  const ps = (get<string>(input, 'proofSystem') ?? getPath(input, 'meta.proofSystem')) as string | undefined;
  const fw = (get<string>(input, 'framework') ?? getPath(input, 'meta.framework')) as string | undefined;
  if (typeof ps === 'string' && ps.toLowerCase() === 'groth16') return true;
  if (typeof fw === 'string' && fw.toLowerCase() === 'snarkjs') return true;
  const proof =
    get(input, 'proof') ??
    getPath(input, 'result.proof') ??
    getPath(input, 'bundle.proof') ??
    getPath(input, 'verification.proof');
  return looksGroth16Proof(proof) || (isObj(proof) && looksGroth16Proof(get(proof, 'proof')));
}

/* -------------------------------- adapter ------------------------------ */
const ID = 'snarkjs-groth16' as const;

export const snarkjsGroth16: Adapter = {
  id: ID,
  proofSystem: 'groth16',
  framework: 'snarkjs',

  canHandle(input: unknown): boolean {
    if (typeof input === 'string') return input.endsWith('.json') || input.startsWith('{') || input.startsWith('[');
    return looksSnarkjsGroth16(input);
  },

async verify(input: unknown): Promise<VerifyOutcome<typeof ID>> {
  try {
    const root = materializeInput(input);   
    const ex = extractFrom(root);          
    if (!ex.vkey || !ex.proof || !ex.publics?.length) {
      return {
        ok: false,
        adapter: ID,
        error: 'adapter_error',
        message: 'Missing vkey/proof/publicSignals for groth16',
      };
    }
    const ok = await groth16.verify(ex.vkey, ex.publics, ex.proof);
    return ok
      ? { ok: true, adapter: ID }
      : { ok: false, adapter: ID, error: 'verification_failed' };
    } catch (err: unknown) {
      return { ok: false, adapter: ID, error: 'adapter_error', message: errorMessage(err) };
    }
  },
};
