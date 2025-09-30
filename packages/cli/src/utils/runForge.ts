// Orchestrate extraction + envelope creation + writing outputs (+ invalid variants)
// ESM, strict TS, no "any".
import { writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve, sep, dirname as pathDirname } from 'node:path';
import { extractTripletFromDir } from './extractTripletFromDir.js';
import { makeEnvelope } from './forgeEnvelope.js';
import type { AdapterId } from '../registry/adapterRegistry.js';

export interface RunForgeArgs {
  in: string;
  adapter?: AdapterId;
  out?: string;
  invalidOut?: string;
  pretty?: boolean;
}

/** Adapter → canonical meta used in the envelope. */
function metaFromAdapter(
  adapter?: AdapterId,
): { proofSystem: 'groth16' | 'plonk'; curve: 'bn128'; prover: string } {
  if (adapter === 'snarkjs-plonk')   return { proofSystem: 'plonk',   curve: 'bn128', prover: 'snarkjs' };
  if (adapter === 'zokrates-groth16')return { proofSystem: 'groth16', curve: 'bn128', prover: 'zokrates' };
  // default & snarkjs-groth16
  return { proofSystem: 'groth16', curve: 'bn128', prover: 'snarkjs' };
}

function writeJson(filePath: string, obj: unknown, pretty: boolean): void {
  const dir = dirname(filePath);
  mkdirSync(dir, { recursive: true });
  const json = pretty ? JSON.stringify(obj, null, 2) : JSON.stringify(obj);
  writeFileSync(filePath, `${json}\n`, 'utf8');
}

/** Force-fail: set the first coordinates to "0" deterministically. */
function forceCorruptSnarkjsProofInPlace(proof: unknown): void {
  if (!proof || typeof proof !== 'object') return;
  const rec = proof as Record<string, unknown>;

  // pi_a: [x, y, 1] -> zero x
  if (Array.isArray(rec.pi_a) && typeof rec.pi_a[0] === 'string') {
    rec.pi_a[0] = '0';
  }
  // pi_b: [[b11,b12],[b21,b22]] -> zero b11
  if (Array.isArray(rec.pi_b)
      && Array.isArray(rec.pi_b[0])
      && typeof rec.pi_b[0][0] === 'string') {
    (rec.pi_b[0] as unknown[])[0] = '0';
  }
  // pi_c: [x, y, 1] -> zero x
  if (Array.isArray(rec.pi_c) && typeof rec.pi_c[0] === 'string') {
    rec.pi_c[0] = '0';
  }
}

/** Produce invalid variants that verify will surely reject. */
function mutateInvalids<TProof, TPublics>(
  env: ReturnType<typeof makeEnvelope<TProof, TPublics>>,
) {
  // 1) Missing vkey
  const missingVkey = structuredClone(env);
  if (missingVkey.artifacts && typeof missingVkey.artifacts === 'object') {
    const arts = missingVkey.artifacts as Record<string, unknown>;
    delete arts.vkey;
    delete arts.verificationPath;
    delete arts.proofPath;
    delete arts.publicsPath;
  }

  // 2) Empty publics
  const emptyPublics = structuredClone(env);
  emptyPublics.result.publicSignals = [] as unknown as TPublics;
  if (emptyPublics.artifacts && typeof emptyPublics.artifacts === 'object') {
    const arts = emptyPublics.artifacts as Record<string, unknown>;
    delete arts.proofPath;
    delete arts.publicsPath;
  }

  // 3) Corrupted proof (coordinates zeroed)
  const corruptedProof = structuredClone(env);
  forceCorruptSnarkjsProofInPlace(corruptedProof.result.proof);
  if (corruptedProof.artifacts && typeof corruptedProof.artifacts === 'object') {
    const arts = corruptedProof.artifacts as Record<string, unknown>;
    delete arts.proofPath;
    delete arts.publicsPath;
  }

  return { missingVkey, emptyPublics, corruptedProof };
}

function findRepoRoot(start: string): string | undefined {
  let dir = start;
  for (let i = 0; i < 6; i++) {
    if (existsSync(join(dir, 'packages'))) return dir;
    const next = pathDirname(dir);
    if (next === dir) break;
    dir = next;
  }
  return undefined;
}

function clearDir(dir: string): void {
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
}

export async function runForge(args: RunForgeArgs): Promise<number> {
  if (!args.in || args.in.trim().length === 0) {
    console.error(JSON.stringify({
      ok: false,
      code: 'FORGE_ERROR',
      message: 'Missing --in option',
    }));
    return 1;
  }

  const baseDir = resolve(args.in);
  const triplet = extractTripletFromDir(baseDir);
  const baseDirAbs = resolve(args.in);  

  function absolutizeVkeySmart(verificationPath?: string): { abs?: string; uri?: string } {
    if (!verificationPath) return {};
    if (isAbsolute(verificationPath) && existsSync(verificationPath)) {
      return { abs: verificationPath, uri: `file://${verificationPath}` };
    }
    // 2) baseDir + rel
    const cand1 = join(baseDirAbs, verificationPath);
    if (existsSync(cand1)) return { abs: cand1, uri: `file://${cand1}` };

    // 3) monorepo root + rel (ha "packages/"-szal indul)
    if (verificationPath.startsWith(`packages${sep}`) || verificationPath.startsWith('packages/')) {
      const repoRoot = findRepoRoot(baseDirAbs) ?? findRepoRoot(process.cwd());
      if (repoRoot) {
        const cand2 = join(repoRoot, verificationPath);
        if (existsSync(cand2)) return { abs: cand2, uri: `file://${cand2}` };
      }
    }
    return {};
  }

  const { abs: vkeyAbs, uri: vkeyUri } = absolutizeVkeySmart(triplet.paths.verificationPath);

  // Canonical meta derived from adapter (never write adapter-id into proofSystem!)
  const meta = metaFromAdapter(args.adapter);

  const envelope = makeEnvelope(
    {
      proofSystem: meta.proofSystem,
      curve: meta.curve,
      prover: meta.prover,
      program: 'unknown',
    },
    {
      proof: triplet.proof,
      publics: triplet.publics,
      paths: {
        verificationPath: vkeyAbs ?? triplet.paths.verificationPath,
        proofPath: triplet.paths.proofPath,
        publicsPath: triplet.paths.publicsPath,
        ...(vkeyUri ? { vkeyUri } : {}),
      },
    },
  );

  const outPath = resolve(args.out ?? 'proof-envelope.result.json');
  writeJson(outPath, envelope, Boolean(args.pretty));

  if (args.invalidOut) {
    const invalidDir = resolve(args.invalidOut);
    clearDir(invalidDir); // <-- takarítsunk élesben is
    const invalids = mutateInvalids(envelope);
    writeJson(resolve(invalidDir, 'proof-envelope.invalid.missing-vkey.json'), invalids.missingVkey, true);
    writeJson(resolve(invalidDir, 'proof-envelope.invalid.empty-publics.json'), invalids.emptyPublics, true);
    writeJson(resolve(invalidDir, 'proof-envelope.invalid.corrupted-proof.json'), invalids.corruptedProof, true);
  }

  return 0;
}
