// packages/cli/src/adapters/snarkjs-groth16.ts
// Robust snarkjs Groth16 adapter:
// - Accepts directory triplet with lenient filenames
// - Accepts inline object (multiple nesting patterns)
// - Normalizes publics (hex -> dec) via auto-normalizer
// - Dumps normalized inputs when enabled
// - Verifies via lazy snarkjsRuntime.getGroth16Verify()

import fss from 'node:fs';
import path from 'node:path';
import type { Adapter, VerifyOutcome } from '../registry/types.js';
import {
  isObj,
  get,
  getPath,
  deepFindByKeys,
  materializeInput,
  coercePublics,
  autoNormalizeForAdapter,
  errorMessage,
  assertG1Tuple,
  assertG2Tuple,
  assertStringArray,
  type ExtractedCommon,
  readFromArtifactRef,
  buildTriplet,
  type Triplet,
  type PublicsU,
  type VerificationKey,
  type ProofObj,
} from './_shared.js';
import { dumpNormalized } from '../utils/dumpNormalized.js';
import { getGroth16Verify } from './snarkjsRuntime.js';

const ID = 'snarkjs-groth16' as const;

/* ------------------------------- helpers -------------------------------- */

function looksLikeGroth16Vk(o: Record<string, unknown>): boolean {
  const need = ['vk_alpha_1', 'vk_beta_2', 'vk_gamma_2', 'vk_delta_2', 'IC'] as const;
  for (const k of need) if (!(k in o)) return false;
  const ic = o['IC'] as unknown;
  return Array.isArray(ic) && ic.length >= 1;
}

function looksLikeGroth16Proof(o: Record<string, unknown>): boolean {
  const pa = o['pi_a'] as unknown;
  const pb = o['pi_b'] as unknown;
  const pc = o['pi_c'] as unknown;
  return Array.isArray(pa) && Array.isArray(pb) && Array.isArray(pc);
}

function listJsonFiles(dir: string): ReadonlyArray<string> {
  try {
    return fss
      .readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isFile() && d.name.toLowerCase().endsWith('.json'))
      .map((d) => path.join(dir, d.name));
  } catch {
    return [];
  }
}

function findFirstExisting(dir: string, names: ReadonlyArray<string>): string | undefined {
  for (const n of names) {
    const p = path.join(dir, n);
    try {
      if (fss.existsSync(p) && fss.statSync(p).isFile()) return p;
    } catch {
      /* ignore */
    }
  }
  return undefined;
}

function readJsonIfExists(file?: string): unknown {
  if (!file) return undefined;
  try {
    const raw = fss.readFileSync(file, 'utf8');
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

function extractFromDir(dir: string): Triplet<PublicsU> {
  let vkey: VerificationKey | undefined;
  let proof: ProofObj | undefined;
  let publics: PublicsU | undefined;

  // --- filename heuristics, first pass ---
  const vkFile = findFirstExisting(dir, [
    'vk.json',
    'vkey.json',
    'verification_key.json',
    'verificationKey.json',
    'verification.key.json',
    'verification.key', // if JSON, parse OK; if not, ignored
  ]);
  const proofFile = findFirstExisting(dir, [
    'proof.json',
    'proof_valid.json',
    'proof.groth16.json',
  ]);
  const publicsFile = findFirstExisting(dir, [
    'public.json',
    'publics.json',
    'publicSignals.json',
    'public_inputs.json',
    'inputs.json',
    'public.json',
  ]);

  const vkeyRaw = readJsonIfExists(vkFile);
  const proofRaw = readJsonIfExists(proofFile);
  const publicsRaw = readJsonIfExists(publicsFile);

  if (isObj(vkeyRaw) && looksLikeGroth16Vk(vkeyRaw as Record<string, unknown>)) {
    vkey = vkeyRaw as VerificationKey;
  }

  if (isObj(proofRaw)) {
    const inner = get(proofRaw, 'proof');
    const cand = isObj(inner)
      ? (inner as Record<string, unknown>)
      : (proofRaw as Record<string, unknown>);
    if (looksLikeGroth16Proof(cand)) proof = cand as ProofObj;
  }

  if (Array.isArray(publicsRaw)) {
    publics = publicsRaw as PublicsU;
  } else if (isObj(publicsRaw)) {
    const maybe = (get(publicsRaw, 'publicSignals') ??
      get(publicsRaw, 'publics') ??
      get(publicsRaw, 'inputs') ??
      get(publicsRaw, 'public')) as unknown;
    if (Array.isArray(maybe)) publics = maybe as PublicsU;
  }
  if (!publics && isObj(proofRaw)) {
    const maybe = (get(proofRaw, 'publicSignals') ?? get(proofRaw, 'inputs')) as unknown;
    if (Array.isArray(maybe)) publics = maybe as PublicsU;
  }

  // --- fallback: scan all JSON files in the dir (shape-based) ---
  if (!vkey || !proof || !publics || publics.length === 0) {
    const files = listJsonFiles(dir);
    const docs = files
      .map((file) => ({ file, doc: readJsonIfExists(file) }))
      .filter(
        (d): d is { file: string; doc: Record<string, unknown> | ReadonlyArray<unknown> } =>
          isObj(d.doc) || Array.isArray(d.doc),
      );

    if (!vkey) {
      const hit = docs.find(
        (d) => isObj(d.doc) && looksLikeGroth16Vk(d.doc as Record<string, unknown>),
      );
      if (hit) vkey = hit.doc as VerificationKey;
    }
    if (!proof) {
      // direct proof object
      let hit = docs.find(
        (d) => isObj(d.doc) && looksLikeGroth16Proof(d.doc as Record<string, unknown>),
      );
      if (!hit) {
        // nested { proof: {...} }
        hit = docs.find((d) => {
          if (!isObj(d.doc)) return false;
          const pr = get(d.doc, 'proof');
          return isObj(pr) && looksLikeGroth16Proof(pr as Record<string, unknown>);
        });
        if (hit) {
          const pr = get(hit.doc as Record<string, unknown>, 'proof') as Record<string, unknown>;
          proof = pr as ProofObj;
        }
      } else {
        proof = hit.doc as ProofObj;
      }
    }
    if (!publics || publics.length === 0) {
      // array root
      const arr = docs.find((d) => Array.isArray(d.doc))?.doc as ReadonlyArray<unknown> | undefined;
      if (arr && arr.length > 0) publics = arr as PublicsU;

      // or object with publics keys
      if (!publics) {
        const hit = docs.find((d) => {
          if (!isObj(d.doc)) return false;
          const m = (get(d.doc, 'publicSignals') ??
            get(d.doc, 'publics') ??
            get(d.doc, 'inputs') ??
            get(d.doc, 'public')) as unknown;
          return Array.isArray(m);
        });
        if (hit) {
          const m = (get(hit.doc as Record<string, unknown>, 'publicSignals') ??
            get(hit.doc as Record<string, unknown>, 'publics') ??
            get(hit.doc as Record<string, unknown>, 'inputs') ??
            get(hit.doc as Record<string, unknown>, 'public')) as unknown;
          publics = m as PublicsU;
        }
      }

      // last resort: extract from proof doc
      if ((!publics || publics.length === 0) && isObj(proof)) {
        const m = (get(proof, 'publicSignals') ??
          get(proof, 'inputs') ??
          get(proof, 'public')) as unknown;
        if (Array.isArray(m)) publics = m as PublicsU;
      }
    }
  }

  return buildTriplet<PublicsU>({
    ...(vkey ? { vkey: vkey as Record<string, unknown> } : {}),
    ...(typeof proof !== 'undefined' ? { proof } : {}),
    ...(publics && publics.length > 0 ? { publics } : {}),
  });
}

function readJsonRelative(relOrAbs: unknown, baseDir?: string): unknown {
  if (typeof relOrAbs !== 'string') return undefined;
  try {
    const p = path.isAbsolute(relOrAbs)
      ? relOrAbs
      : baseDir
        ? path.join(baseDir, relOrAbs)
        : relOrAbs;
    const raw = fss.readFileSync(p, 'utf8');
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

function extractFromObject(root: unknown, baseDir?: string): Triplet<PublicsU> {
  let vkey: VerificationKey | undefined;
  let proof: ProofObj | undefined;
  let publics: PublicsU | undefined;

  // 1) Common placements
  const vkeyTop = get(root, 'verificationKey');
  if (isObj(vkeyTop)) vkey = vkeyTop as VerificationKey;

  const res = get(root, 'result');
  if (isObj(res)) {
    const pr = get(res, 'proof');
    if (isObj(pr)) proof = pr as ProofObj;

    const psRes = (get(res, 'publicSignals') ?? get(res, 'public_inputs')) as unknown;
    if (Array.isArray(psRes)) publics = psRes as PublicsU;
  }

  // 2) Fallbacks for vkey (extended with string-path resolution)
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

    if (isObj(cand)) {
      // Try artifact ref first (e.g., { uri: "file://...", path: "..." })
      const loaded = readFromArtifactRef(cand, baseDir);
      if (isObj(loaded)) {
        vkey = loaded as VerificationKey;
      } else {
        // Inline vkey object (already the VK itself)
        vkey = cand as VerificationKey;
      }
    } else {
      // String path → resolve relative to baseDir / CWD
      const loaded = readJsonRelative(cand, baseDir);
      if (isObj(loaded)) vkey = loaded as VerificationKey;
    }
  }

  // 3) Fallbacks for proof (extended with string-path resolution)
  if (!proof) {
    const cand =
      get(root, 'proof') ??
      getPath(root, 'bundle.proof') ??
      getPath(root, 'artifacts.proof') ??
      getPath(root, 'verification.proof') ??
      getPath(root, 'result.proof') ??
      deepFindByKeys(root, ['proof', 'pi_a']); // pi_a hints Groth16 proof object

    if (isObj(cand)) {
      // Inline object? Prefer nested "proof" if present
      const inner = get(cand, 'proof');
      if (isObj(inner)) {
        proof = inner as ProofObj;
      } else {
        // Artifact ref object → load, then prefer nested 'proof' if exists
        const loaded = readFromArtifactRef(cand, baseDir);
        if (isObj(loaded)) {
          const inner2 = get(loaded, 'proof');
          proof = isObj(inner2) ? (inner2 as ProofObj) : (loaded as ProofObj);
        } else {
          // Fallback: treat 'cand' itself as proof object
          proof = cand as ProofObj;
        }
      }
    } else {
      // String path → resolve/load, then prefer nested 'proof' if exists
      const loaded = readJsonRelative(cand, baseDir);
      if (isObj(loaded)) {
        const inner = get(loaded, 'proof');
        proof = isObj(inner) ? (inner as ProofObj) : (loaded as ProofObj);
      }
    }
  }

  // 4) Fallbacks for publics (artifact refs, string paths, or nested arrays)
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
      // Artifact ref → load; accept either a bare array or known keys
      const loaded = readFromArtifactRef(cand, baseDir);
      if (Array.isArray(loaded)) {
        publics = loaded as PublicsU;
      } else if (isObj(loaded)) {
        const arr = (get(loaded, 'publicSignals') ??
          get(loaded, 'publicInputs') ??
          get(loaded, 'inputs') ??
          get(loaded, 'public')) as unknown;
        if (Array.isArray(arr)) publics = arr as PublicsU;
      } else {
        // Inline object: try common keys directly
        const arr = (get(cand, 'publicSignals') ??
          get(cand, 'publicInputs') ??
          get(cand, 'inputs') ??
          get(cand, 'public')) as unknown;
        if (Array.isArray(arr)) publics = arr as PublicsU;
      }
    } else {
      // String path → resolve; accept either a bare array or known keys
      const loaded = readJsonRelative(cand, baseDir);
      if (Array.isArray(loaded)) {
        publics = loaded as PublicsU;
      } else if (isObj(loaded)) {
        const arr = (get(loaded, 'publicSignals') ??
          get(loaded, 'publicInputs') ??
          get(loaded, 'inputs') ??
          get(loaded, 'public')) as unknown;
        if (Array.isArray(arr)) publics = arr as PublicsU;
      }
    }
  }

  return buildTriplet<PublicsU>({
    ...(vkey ? { vkey: vkey as Record<string, unknown> } : {}),
    ...(typeof proof !== 'undefined' ? { proof } : {}),
    ...(publics && publics.length > 0 ? { publics } : {}),
  });
}

/* -------------------------------- adapter -------------------------------- */

export const snarkjsGroth16: Adapter = {
  id: ID,
  proofSystem: 'groth16',
  framework: 'snarkjs',

  canHandle(input: unknown): boolean {
    if (typeof input === 'string') return input.length > 0;
    if (!isObj(input)) return false;
    // quick sniff: protocol/framework/proof fields
    const ps = get(input, 'proofSystem');
    const fw = get(input, 'framework');
    if (typeof ps === 'string' && ps.toLowerCase() === 'groth16') return true;
    if (typeof fw === 'string' && fw.toLowerCase() === 'snarkjs') return true;
    // or presence of groth proof tuples
    const pf = get(input, 'proof') ?? getPath(input, 'result.proof');
    return (
      isObj(pf) &&
      (Array.isArray(get(pf, 'pi_a')) ||
        Array.isArray(get(pf, 'pi_b')) ||
        Array.isArray(get(pf, 'pi_c')))
    );
  },

  async verify(input: unknown): Promise<VerifyOutcome<typeof ID>> {
    try {
      const root = materializeInput(input);
      const baseDir = typeof input === 'string' ? path.dirname(input) : undefined;

      let exSpecific: Triplet<PublicsU> = {};
      let inputKind: 'dir' | 'file' | 'inline' | 'unknown' = 'unknown';

      if (typeof root === 'string') {
        const st = fss.statSync(root);
        if (st.isDirectory()) {
          exSpecific = extractFromDir(root);
          inputKind = 'dir';
        } else if (st.isFile()) {
          const doc = readJsonIfExists(root);
          if (isObj(doc)) {
            exSpecific = extractFromObject(doc as Record<string, unknown>, baseDir);
            inputKind = 'file';
          }
        }
      } else if (isObj(root)) {
        exSpecific = extractFromObject(root as Record<string, unknown>, baseDir);
        inputKind = 'inline';
      }

      // pre-dump even if missing, but without undefined fields
      dumpNormalized(ID, {
        meta: {
          preExtract: true,
          inputKind,
          haveVkey: !!exSpecific.vkey,
          haveProof: !!exSpecific.proof,
          publics: exSpecific.publics?.length ?? 0,
          ...(typeof input === 'string' ? { path: input } : {}),
        },
      });

      const exCommon: ExtractedCommon = {
        ...(exSpecific.vkey ? { vkey: exSpecific.vkey as Record<string, unknown> } : {}),
        ...(typeof exSpecific.proof !== 'undefined' ? { proof: exSpecific.proof } : {}),
        ...(exSpecific.publics?.length ? { publics: coercePublics(exSpecific.publics) } : {}),
      };

      const { value: exN } = autoNormalizeForAdapter(ID, exCommon);
      if (!exN.vkey || !exN.proof || !exN.publics?.length) {
        return {
          ok: false,
          adapter: ID,
          error: 'adapter_error',
          message: 'Missing vkey/proof/publicSignals for snarkjs-groth16',
        };
      }

      const vkeySnark = exN.vkey as Record<string, unknown>;
      const proofSnark = exN.proof as Record<string, unknown>;
      const publicsDec = exN.publics;

      const IC = vkeySnark['IC'] as unknown;
      if (!Array.isArray(IC) || IC.length !== publicsDec.length + 1) {
        throw new Error(
          `Invalid IC length: expected ${publicsDec.length + 1}, got ${Array.isArray(IC) ? IC.length : -1}`,
        );
      }
      assertG1Tuple(vkeySnark['vk_alpha_1'], 'vk_alpha_1');
      assertG2Tuple(vkeySnark['vk_beta_2'], 'vk_beta_2');
      assertG2Tuple(vkeySnark['vk_gamma_2'], 'vk_gamma_2');
      assertG2Tuple(vkeySnark['vk_delta_2'], 'vk_delta_2');
      for (let i = 0; i < IC.length; i += 1) assertG1Tuple(IC[i], `IC[${i}]`);

      assertG1Tuple(proofSnark['pi_a'], 'pi_a');
      assertG2Tuple(proofSnark['pi_b'], 'pi_b');
      assertG1Tuple(proofSnark['pi_c'], 'pi_c');
      assertStringArray(publicsDec, 'publicSignals');

      dumpNormalized(ID, {
        vkey: vkeySnark,
        proof: proofSnark,
        publics: publicsDec,
        meta: { IC: IC.length, publics: publicsDec.length },
      });

      const verifyGroth16 = await getGroth16Verify();
      const ok = await verifyGroth16(vkeySnark as object, publicsDec, proofSnark as object);
      return ok
        ? { ok: true, adapter: ID }
        : { ok: false, adapter: ID, error: 'verification_failed' as const };
    } catch (err: unknown) {
      return { ok: false, adapter: ID, error: 'adapter_error', message: errorMessage(err) };
    }
  },
};
