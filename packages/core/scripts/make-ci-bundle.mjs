// packages/core/scripts/make-ci-bundle.mjs
// Usage:
//   node packages/core/scripts/make-ci-bundle.mjs <input-bundle.json> [<output.json>]
// Creates an *inline* bundle (verificationKey + result.proof + result.publicSignals), no artifacts.

import { readFile, stat } from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFile } from '#fs-compat';

// ---------- tiny utils ----------

function asLocalPath(maybe) {
  if (typeof maybe !== 'string') return undefined;
  try {
    // convert file:// URIs to absolute paths
    if (maybe.startsWith('file:')) return fileURLToPath(maybe);
  } catch {
    /* ignore */
  }
  return maybe;
}

function isRepoRelative(p) {
  if (typeof p !== 'string') return false;
  const n = p.replace(/^\.\/+/, ''); // strip leading ./ for safety
  return n.startsWith(`packages${path.sep}`);
}

function pickPathLike(obj, keys) {
  if (!obj || typeof obj !== 'object') return undefined;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim() !== '') return v;
  }
  return undefined;
}

async function readJson(p) {
  const s = await readFile(p, 'utf8');
  return JSON.parse(s);
}

function norm1(v) {
  if (Array.isArray(v)) return v;
  if (v && typeof v === 'object') {
    const keys = Object.keys(v)
      .filter((k) => /^\d+$/.test(k))
      .map(Number)
      .sort((a, b) => a - b);
    if (keys.length) return keys.map((k) => v[String(k)]);
  }
  return undefined;
}

function norm2(v) {
  const o = norm1(v);
  if (!o) return undefined;
  const out = [];
  for (const row of o) {
    const r = norm1(row);
    if (!r) return undefined;
    out.push(r);
  }
  return out;
}

function normalizeProof(raw) {
  if (!raw || typeof raw !== 'object') return undefined;
  const a = norm1(raw.pi_a ?? raw.a);
  const b = norm2(raw.pi_b ?? raw.b);
  const c = norm1(raw.pi_c ?? raw.c);
  if (!a || !b || !c) return undefined;
  return { pi_a: a, pi_b: b, pi_c: c };
}

function toDecString(x) {
  if (typeof x === 'string') {
    const s = x.trim();
    if (/^0x[0-9a-f]+$/i.test(s)) return BigInt(s).toString(10);
    return s;
  }
  if (typeof x === 'number') return String(x);
  if (typeof x === 'bigint') return x.toString(10);
  return String(x);
}

function normalizePublicSignals(arr) {
  return (arr ?? []).map(toDecString);
}

function resolveRefPath(baseDir, ref) {
  const ws = process.env.GITHUB_WORKSPACE || process.cwd();
  const local = asLocalPath(ref);
  if (!local) return undefined;

  // absolute stays absolute
  if (path.isAbsolute(local)) return local;

  // repo-root relative 'packages/...'
  if (isRepoRelative(local)) return path.join(ws, local);

  // otherwise treat as relative to the bundle directory
  return path.resolve(baseDir, local);
}

// ---------- main ----------

async function main() {
  // robust argv parsing
  const argv = process.argv.slice(2).filter((s) => typeof s === 'string' && s.trim() !== '');
  const inPathArg = argv[0];
  const outPathArg = argv[1];

  if (!inPathArg) {
    console.error('Usage: node make-ci-bundle.mjs <input-bundle.json> [<output.json>]');
    process.exit(2);
  }

  // normalize input path
  const inLocal = asLocalPath(inPathArg) ?? '';
  const absIn = path.isAbsolute(inLocal) ? inLocal : path.resolve(process.cwd(), inLocal);

  // ensure input exists early
  try {
    const st = await stat(absIn);
    if (!st.isFile()) {
      console.error(`Not a file: ${absIn}`);
      process.exit(4);
    }
  } catch {
    console.error(`Input not found: ${absIn}`);
    process.exit(4);
  }

  const baseDir = path.dirname(absIn);
  const raw = await readFile(absIn, 'utf8');
  const bundle = JSON.parse(raw);

  // If already inline, keep as base and normalize publics
  const hasInlineVkey = bundle && typeof bundle === 'object' && bundle.verificationKey;
  const hasInlineProof = bundle?.result?.proof;
  const hasInlinePublics = Array.isArray(bundle?.result?.publicSignals);

  let vkey = bundle.verificationKey;
  let proof = hasInlineProof ? normalizeProof(bundle.result.proof) : undefined;
  let publicSignals = hasInlinePublics
    ? normalizePublicSignals(bundle.result.publicSignals)
    : undefined;

  // If missing, read from artifacts (relative to bundle dir or repo root)
  const artifacts = bundle && typeof bundle === 'object' ? bundle.artifacts : undefined;

  if (!hasInlineVkey) {
    const vkeyRef = artifacts?.vkey;
    const vkeyPathStr =
      typeof vkeyRef === 'string' ? vkeyRef : pickPathLike(vkeyRef ?? {}, ['path', 'uri', 'url']);
    if (!vkeyPathStr) {
      console.error('Missing artifacts.vkey path/uri');
      process.exit(4);
    }
    const vkeyAbs = resolveRefPath(baseDir, vkeyPathStr);
    vkey = await readJson(vkeyAbs);
  }

  let proofFile;
  if (!proof) {
    const proofRef = artifacts?.proof;
    const proofPathStr =
      typeof proofRef === 'string'
        ? proofRef
        : pickPathLike(proofRef ?? {}, ['path', 'uri', 'url']);
    if (!proofPathStr) {
      console.error('Missing artifacts.proof path/uri');
      process.exit(4);
    }
    const proofAbs = resolveRefPath(baseDir, proofPathStr);
    proofFile = await readJson(proofAbs);
    const rawProof =
      proofFile && typeof proofFile === 'object' && 'proof' in proofFile
        ? proofFile.proof
        : proofFile;
    proof = normalizeProof(rawProof);
    if (!proof) {
      console.error('Failed to normalize proof from artifacts.proof');
      process.exit(4);
    }
  }

  if (!publicSignals) {
    if (!proofFile) {
      // if not loaded above:
      const proofRef = artifacts?.proof;
      const proofPathStr =
        typeof proofRef === 'string'
          ? proofRef
          : pickPathLike(proofRef ?? {}, ['path', 'uri', 'url']);
      if (proofPathStr) {
        const proofAbs = resolveRefPath(baseDir, proofPathStr);
        proofFile = await readJson(proofAbs);
      }
    }
    let publicsRaw =
      proofFile && Array.isArray(proofFile.publicSignals) ? proofFile.publicSignals : undefined;

    if (!publicsRaw) {
      const pubRef = artifacts?.publicSignals;
      const pubPathStr =
        typeof pubRef === 'string' ? pubRef : pickPathLike(pubRef ?? {}, ['path', 'uri', 'url']);
      if (!pubPathStr) {
        console.error('Missing artifacts.publicSignals path/uri');
        process.exit(4);
      }
      const pubAbs = resolveRefPath(baseDir, pubPathStr);
      const pubFile = await readJson(pubAbs);
      publicsRaw = Array.isArray(pubFile)
        ? pubFile
        : pubFile && typeof pubFile === 'object' && Array.isArray(pubFile.publicSignals)
          ? pubFile.publicSignals
          : undefined;
    }

    if (!publicsRaw) {
      console.error('Failed to get publicSignals');
      process.exit(4);
    }
    publicSignals = normalizePublicSignals(publicsRaw);
  }

  const outBundle = {
    ...bundle,
    verificationKey: vkey,
    result: {
      ...(bundle.result && typeof bundle.result === 'object' ? bundle.result : {}),
      proof,
      publicSignals,
    },
  };
  outBundle.$schema = 'urn:zkpip:mvs:schemas:verification.schema.json';
  delete outBundle.artifacts;

  const outPath = outPathArg
    ? path.isAbsolute(outPathArg)
      ? outPathArg
      : path.resolve(process.cwd(), outPathArg)
    : path.join(path.dirname(absIn), path.basename(absIn).replace(/\.json$/i, '.ci.valid.json'));

  await writeFile(outPath, JSON.stringify(outBundle, null, 2));
  console.log(outPath);
}

await main();
