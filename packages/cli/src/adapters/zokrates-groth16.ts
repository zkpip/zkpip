// packages/cli/src/adapters/zokrates-groth16.ts
// ESM-only, NodeNext, no "any" types

import fs from 'node:fs';
import path from 'node:path';
import { parseZoKratesVerifierSol } from '../parsers/solidity/zokratesVerifier.js';
import { getGroth16Verify } from './snarkjsRuntime.js';

// Local shared utilities (ESM imports must include .js)
import {
  isObj,
  materializeInput,
  coercePublics,
  autoNormalizeForAdapter,
  errorMessage,
  buildTriplet,
  type PublicSignals,
  type Triplet,
  assertG1Tuple,
  assertG2Tuple,
  get,
  getPath,
  readFromArtifactRef,
  readJsonRelative,
  deepFindByKeys,
  type PublicsU,
  type VerificationKey,
  type ProofObj,
} from './_shared.js';

import type { Adapter, VerifyOutcome } from '../registry/types.js';
import { dumpNormalized } from '../utils/dumpNormalized.js';

export const ID = 'zokrates-groth16' as const;

function isString(x: unknown): x is string {
  return typeof x === 'string';
}

function readJsonIfExists(filePath: string): unknown | undefined {
  try {
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return undefined;
    const raw = fs.readFileSync(filePath, 'utf8');
    // ZoKrates .key is typically not JSON; guard against that
    const first = raw.trim()[0] ?? '';
    if (first !== '{' && first !== '[') return undefined;
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

/** Pick the actual vector directory if a top-level folder contains "valid/" or "invalid/". */
function resolveVectorDir(inputDir: string): string {
  const stat = fs.existsSync(inputDir) ? fs.statSync(inputDir) : undefined;
  if (!stat) return inputDir;
  if (stat.isFile()) return path.dirname(inputDir);

  // If already points to "valid" or "invalid", keep it.
  const base = path.basename(inputDir);
  if (base === 'valid' || base === 'invalid') return inputDir;

  // If it contains "valid/" or "invalid/" pick "valid" by default for smoke,
  // unless only "invalid" exists.
  const entries = fs.readdirSync(inputDir, { withFileTypes: true });
  const hasValid = entries.some((d) => d.isDirectory() && d.name === 'valid');
  const hasInvalid = entries.some((d) => d.isDirectory() && d.name === 'invalid');
  if (hasValid) return path.join(inputDir, 'valid');
  if (hasInvalid) return path.join(inputDir, 'invalid');
  return inputDir;
}

/** File picking with relaxed patterns */
function findFirstExisting(dir: string, candidates: readonly string[]): string | undefined {
  for (const name of candidates) {
    const p = path.join(dir, name);
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  }
  return undefined;
}

/** Probe dir for ZoKrates triplet */
function extractFromDir(dir: string): Triplet {
  const actual = resolveVectorDir(dir);

  // VK candidates (prefer JSON)
  const vkFile = findFirstExisting(actual, [
    'vk.json',
    'verification.key.json',
    'verification_key.json',
    'verificationKey.json',
    'verification.key', // likely non-JSON; readJsonIfExists will skip it
  ]);

  const proofFile = findFirstExisting(actual, ['proof.json', 'proof_valid.json']);
  const publicsFile = findFirstExisting(actual, [
    'public.json',
    'publics.json',
    'public_inputs.json',
    'publicSignals.json',
    'inputs.json',
  ]);

  const vkeyRaw = vkFile ? readJsonIfExists(vkFile) : undefined;
  const proofDoc = proofFile ? readJsonIfExists(proofFile) : undefined;
  const publicsDoc = publicsFile ? readJsonIfExists(publicsFile) : undefined;

  // Extract publics:
  // 1) Separate publics*.json if present
  // 2) Else from proof.json → { inputs: [...] } (ZoKrates style)
  let publics: PublicSignals | undefined;
  if (Array.isArray(publicsDoc)) {
    publics = publicsDoc as PublicSignals;
  } else if (isObj(publicsDoc)) {
    // Some generators wrap publics
    const maybe =
      (publicsDoc as Record<string, unknown>)['inputs'] ??
      (publicsDoc as Record<string, unknown>)['publicSignals'] ??
      (publicsDoc as Record<string, unknown>)['public'];
    if (Array.isArray(maybe)) {
      publics = maybe as PublicSignals;
    }
  }
  if (!publics && isObj(proofDoc)) {
    const maybe =
      (proofDoc as Record<string, unknown>)['inputs'] ??
      (proofDoc as Record<string, unknown>)['publicSignals'];
    if (Array.isArray(maybe)) {
      publics = maybe as PublicSignals;
    }
  }

  // Extract proof object:
  // ZoKrates proof.json usually: { "proof": {a,b,c}, "inputs": [...] }
  // Pass through the inner "proof" if present; otherwise the whole doc.
  const proof: unknown =
    isObj(proofDoc) && isObj((proofDoc as Record<string, unknown>)['proof'])
      ? ((proofDoc as Record<string, unknown>)['proof'] as Record<string, unknown>)
      : proofDoc;

  // Cast vkey to dictionary-like if JSON
  let vkey = isObj(vkeyRaw) ? (vkeyRaw as Record<string, unknown>) : undefined;

  if (!vkey) {
    const solFile = findFirstExisting(actual, ['verifier.sol', 'Verifier.sol']);
    if (solFile) {
      const solSrc = fs.readFileSync(solFile, 'utf8');
      try {
        const parsed = parseZoKratesVerifierSol(solSrc);
        // Cast to dictionary-like; normalizer will finish the job
        vkey = parsed as unknown as Record<string, unknown>;
        // (Opcionális) log: actions.push('vk:sol→json');
      } catch {
        // ignore parse errors; let normalizer handle missing vkey
      }
    }
  }

  // Build without emitting undefined-valued optional keys
  return buildTriplet<PublicsU>({
    ...(vkey ? { vkey: vkey as Record<string, unknown> } : {}),
    ...(typeof proof !== 'undefined' ? { proof } : {}),
    ...(publics && publics.length > 0 ? { publics } : {}),
  });
}

/** Extract triplet from object-shaped inline bundle */
function extractFromObject(root: Record<string, unknown>): Triplet<PublicsU> {
  let vkey: VerificationKey | undefined;
  let proof: ProofObj | undefined;
  let publics: PublicsU | undefined;

  // ---- local helpers (no baseDir required) ---------------------------------
  // Safely parse JSON if the source is a string; otherwise return as-is.
  const parseJsonMaybe = (src: unknown): unknown => {
    if (typeof src === 'string') {
      try {
        return JSON.parse(src) as unknown;
      } catch {
        /* ignore */
      }
    }
    return src;
  };

  // Unwrap common proof shapes:
  //  - ZoKrates-native: { a, b, c }
  //  - snarkjs-like:    { pi_a, pi_b, pi_c }
  //  - Nested:          { proof: {...} } or { result: { proof: {...} } }
  const unwrapProofLike = (src: unknown): ProofObj | undefined => {
    if (!isObj(src)) return undefined;
    const obj = src as Record<string, unknown>;

    const isDirectZo = obj.a != null && obj.b != null && obj.c != null;
    const isDirectSn = obj.pi_a != null && obj.pi_b != null && obj.pi_c != null;
    if (isDirectZo || isDirectSn) return obj as ProofObj;

    const nested = (get(obj, 'proof') as unknown) ?? (getPath(obj, 'result.proof') as unknown);
    if (isObj(nested)) {
      const n = nested as Record<string, unknown>;
      const ok =
        (n.a != null && n.b != null && n.c != null) ||
        (n.pi_a != null && n.pi_b != null && n.pi_c != null);
      return ok ? (n as ProofObj) : undefined;
    }
    return undefined;
  };

  // ---- Verification key ----------------------------------------------------
  // Inline shortcuts
  const vkTop = get(root, 'verificationKey') as unknown;
  if (isObj(vkTop)) vkey = vkTop as VerificationKey;
  if (!vkey) {
    const vkAlt = (get(root, 'vk') as unknown) ?? (get(root, 'verification_key') as unknown);
    if (isObj(vkAlt)) vkey = vkAlt as VerificationKey;
  }
  // Nested / artifacts / generic deep search
  if (!vkey) {
    const cand =
      getPath(root, 'result.verificationKey') ??
      get(root, 'vkey') ??
      getPath(root, 'bundle.verificationKey') ??
      getPath(root, 'meta.verificationKey') ??
      getPath(root, 'artifacts.verificationKey') ??
      getPath(root, 'artifacts.vkey') ??
      getPath(root, 'verification.verificationKey') ??
      deepFindByKeys(root, ['verificationKey', 'vkey', 'vk', 'key']);

    if (cand != null) {
      if (isObj(cand)) {
        // ArtifactRef or inline object
        const loaded = parseJsonMaybe(readFromArtifactRef(cand));
        if (isObj(loaded)) vkey = loaded as VerificationKey;
        else vkey = cand as VerificationKey; // tolerate inline object
      } else if (typeof cand === 'string') {
        const loaded = parseJsonMaybe(readJsonRelative(cand));
        if (isObj(loaded)) vkey = loaded as VerificationKey;
      }
    }
  }

  // ---- Proof ---------------------------------------------------------------
  // Inline shortcuts
  const prTop = get(root, 'proof') as unknown;
  if (!proof && isObj(prTop)) proof = unwrapProofLike(prTop);
  if (!proof) {
    const res = get(root, 'result') as unknown;
    if (isObj(res)) {
      const prRes = get(res as Record<string, unknown>, 'proof') as unknown;
      if (isObj(prRes)) proof = unwrapProofLike(prRes);
    }
  }
  // Nested / artifacts / generic deep search
  if (!proof) {
    const cand =
      get(root, 'proof') ??
      getPath(root, 'bundle.proof') ??
      getPath(root, 'artifacts.proof') ??
      getPath(root, 'verification.proof') ??
      getPath(root, 'result.proof') ??
      deepFindByKeys(root, ['proof', 'pi_a', 'a']);

    if (cand != null) {
      if (isObj(cand)) {
        const loaded = parseJsonMaybe(readFromArtifactRef(cand));
        const unwrapped = unwrapProofLike(loaded) ?? unwrapProofLike(cand);
        if (unwrapped) proof = unwrapped;
      } else if (typeof cand === 'string') {
        const loaded = parseJsonMaybe(readJsonRelative(cand));
        const unwrapped = unwrapProofLike(loaded);
        if (unwrapped) proof = unwrapped;
      }
    }
  }

  // ---- Publics -------------------------------------------------------------
  // Inline shortcuts
  const topPublics =
    (Array.isArray(get(root, 'publicSignals'))
      ? (get(root, 'publicSignals') as PublicsU)
      : undefined) ??
    (Array.isArray(get(root, 'publicInputs'))
      ? (get(root, 'publicInputs') as PublicsU)
      : undefined) ??
    (Array.isArray(get(root, 'inputs')) ? (get(root, 'inputs') as PublicsU) : undefined) ??
    (Array.isArray(get(root, 'publics')) ? (get(root, 'publics') as PublicsU) : undefined) ??
    (Array.isArray(get(root, 'public')) ? (get(root, 'public') as PublicsU) : undefined);
  if (topPublics) publics = topPublics;

  // Nested containers
  if (!publics) {
    const r = get(root, 'result') as unknown;
    if (isObj(r)) {
      const resPublics =
        (Array.isArray(get(r, 'publicSignals'))
          ? (get(r, 'publicSignals') as PublicsU)
          : undefined) ??
        (Array.isArray(get(r, 'publicInputs'))
          ? (get(r, 'publicInputs') as PublicsU)
          : undefined) ??
        (Array.isArray(get(r, 'inputs')) ? (get(r, 'inputs') as PublicsU) : undefined) ??
        (Array.isArray(get(r, 'public')) ? (get(r, 'public') as PublicsU) : undefined);
      if (resPublics) publics = resPublics;
    }
  }

  // Artifacts / deep search
  if (!publics || publics.length === 0) {
    const cand =
      getPath(root, 'bundle.publicSignals') ??
      getPath(root, 'artifacts.publicSignals') ??
      getPath(root, 'verification.publicSignals') ??
      get(root, 'publicSignals') ??
      get(root, 'publicInputs') ??
      get(root, 'inputs') ??
      get(root, 'public') ??
      deepFindByKeys(root, [
        'publicSignals',
        'public_inputs',
        'publicInputs',
        'inputs',
        'public',
        'publics',
      ]);

    if (Array.isArray(cand)) {
      publics = cand as PublicsU;
    } else if (isObj(cand)) {
      const loaded = parseJsonMaybe(readFromArtifactRef(cand));
      if (Array.isArray(loaded)) publics = loaded as PublicsU;
      else if (isObj(loaded)) {
        const arr =
          (get(loaded, 'publicSignals') as unknown) ??
          (get(loaded, 'publicInputs') as unknown) ??
          (get(loaded, 'inputs') as unknown) ??
          (get(loaded, 'public') as unknown);
        if (Array.isArray(arr)) publics = arr as PublicsU;
      }
    } else if (typeof cand === 'string') {
      const loaded = parseJsonMaybe(readJsonRelative(cand));
      if (Array.isArray(loaded)) publics = loaded as PublicsU;
    }
  }

  // Fallback: some generators embed publics inside the proof object
  if ((!publics || publics.length === 0) && isObj(proof)) {
    const p = proof as Record<string, unknown>;
    const psFromProof =
      (Array.isArray(get(p, 'publicSignals'))
        ? (get(p, 'publicSignals') as PublicsU)
        : undefined) ??
      (Array.isArray(get(p, 'publicInputs')) ? (get(p, 'publicInputs') as PublicsU) : undefined) ??
      (Array.isArray(get(p, 'inputs')) ? (get(p, 'inputs') as PublicsU) : undefined) ??
      (Array.isArray(get(p, 'public')) ? (get(p, 'public') as PublicsU) : undefined);
    if (psFromProof) publics = psFromProof;
  }

  // ---- Build triplet -------------------------------------------------------
  return buildTriplet<PublicsU>({
    ...(vkey ? { vkey: vkey as Record<string, unknown> } : {}),
    ...(typeof proof !== 'undefined' ? { proof } : {}),
    ...(publics && publics.length > 0 ? { publics } : {}),
  });
}

// Keep the original named export for local imports
export const zokratesGroth16: Adapter = {
  id: ID,
  proofSystem: 'groth16',
  framework: 'zokrates',

  // Lightweight detector: any hint of zokrates + groth16 markers
  canHandle(input: unknown): boolean {
    const root = materializeInput(input);
    if (isString(root)) {
      const dir = resolveVectorDir(root);
      const names =
        fs.existsSync(dir) && fs.statSync(dir).isDirectory()
          ? fs.readdirSync(dir).map((n) => n.toLowerCase())
          : [];
      const hasProof = names.some((n) => n.includes('proof') && n.endsWith('.json'));
      const hasVk = names.some((n) => n.includes('vk') || n.includes('verification'));
      return hasProof && hasVk;
    }
    if (isObj(root)) {
      const obj = root as Record<string, unknown>;
      const hasVk = isObj(obj['verificationKey']) || isObj(obj['vk']);
      const hasProof = isObj(obj['proof']) || isObj(obj['result']);
      const hasInputs =
        Array.isArray(obj['inputs']) ||
        Array.isArray(obj['publicSignals']) ||
        Array.isArray(obj['publics']);
      return !!(hasVk && hasProof && hasInputs);
    }
    return false;
  },

  async verify(input: unknown): Promise<VerifyOutcome> {
    try {
      const root = materializeInput(input);
      const exSpecific = isString(root)
        ? extractFromDir(root)
        : isObj(root)
          ? extractFromObject(root as Record<string, unknown>)
          : {};

      const exCommon = {
        ...(exSpecific.vkey ? ({ vkey: exSpecific.vkey } as const) : {}),
        ...(exSpecific.proof ? ({ proof: exSpecific.proof } as const) : {}),
        ...(exSpecific.publics?.length
          ? ({ publics: coercePublics(exSpecific.publics) } as const)
          : {}),
      } as const;

      const { value: exN } = autoNormalizeForAdapter(ID, exCommon);

      if (!exN.vkey || !exN.proof || !exN.publics?.length) {
        return {
          ok: false,
          adapter: ID,
          error: 'adapter_error',
          message: 'Missing vkey/proof/publicSignals for zokrates-groth16',
        };
      }

      const vkeySnark = exN.vkey as Record<string, unknown>;
      const proofSnark = exN.proof as Record<string, unknown>;
      const publicsDec = exN.publics;

      assertG1Tuple(vkeySnark.vk_alpha_1, 'vk_alpha_1');
      assertG2Tuple(vkeySnark.vk_beta_2, 'vk_beta_2');
      assertG2Tuple(vkeySnark.vk_gamma_2, 'vk_gamma_2');
      assertG2Tuple(vkeySnark.vk_delta_2, 'vk_delta_2');

      const icUnknown = (vkeySnark as Record<string, unknown>).IC as unknown; // <-- IC
      if (!Array.isArray(icUnknown)) {
        throw new Error('Invalid IC: expected array');
      }
      if (icUnknown.length !== publicsDec.length + 1) {
        throw new Error(
          `Invalid IC length: expected ${publicsDec.length + 1}, got ${icUnknown.length}`,
        );
      }
      for (let i = 0; i < icUnknown.length; i += 1) {
        assertG1Tuple(icUnknown[i], `IC[${i}]`);
      }

      assertG1Tuple(proofSnark.pi_a, 'pi_a');
      assertG2Tuple(proofSnark.pi_b, 'pi_b');
      assertG1Tuple(proofSnark.pi_c, 'pi_c');

      // Dump
      dumpNormalized(ID, {
        vkey: vkeySnark,
        proof: proofSnark,
        publics: publicsDec,
        meta: { publics: publicsDec.length, IC: icUnknown.length },
      });

      // Verify here
      let ok: boolean;
      try {
        const verifyGroth16 = await getGroth16Verify();
        ok = await verifyGroth16(vkeySnark as object, publicsDec, proofSnark as object);
      } catch (e: unknown) {
        const msg = errorMessage(e);
        const stack =
          process.env.ZKPIP_DEBUG && (e as Error)?.stack ? `\n${(e as Error).stack}` : '';
        return {
          ok: false,
          adapter: ID,
          error: 'adapter_error',
          message: `snarkjs.verify threw: ${msg}${stack}`,
        };
      }

      return ok
        ? { ok: true, adapter: ID }
        : { ok: false, adapter: ID, error: 'verification_failed' as const };
    } catch (err: unknown) {
      return { ok: false, adapter: ID, error: 'adapter_error', message: errorMessage(err) };
    }
  },
};
