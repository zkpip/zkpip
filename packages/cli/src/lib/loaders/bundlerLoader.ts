// packages/cli/src/lib/loaders/bundleLoader.ts
// Single-responsibility loader for { vkey, proof, publicSignals }.
// - ESM, NodeNext
// - No "any"; use unknown where needed
// - exactOptionalPropertyTypes-friendly

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

// -------- Types --------

type Sha256 = { alg: 'sha256'; value: string };

type ArtifactRef = {
  path?: string;           // relative to the bundle.json directory
  uri?: string;            // e.g. file:///abs/path/to/file.json
  size?: number;
  mediaType?: string;
  hash?: Sha256;           // optional SHA-256 hex of the raw file
};

type BundleArtifacts = Partial<{
  vkey: ArtifactRef;
  proof: ArtifactRef;
  publicSignals: ArtifactRef;
  // other artifacts may exist but are irrelevant for verify()
}>;

type Bundle = {
  artifacts?: BundleArtifacts;
  result?: {
    proof?: unknown;            // kept as unknown; adapter knows snarkjs shape
    publicSignals?: unknown[];  // normalized later to string[]
  };
  // other fields are ignored by the loader
};

type MetaPaths = { vkey: string } & Partial<{ proof: string; publicSignals: string }>;

export type LoadedVerifyInputs = {
  vkey: unknown;
  proof: unknown;
  publicSignals: string[];
  meta?: {
    sources: {
      vkey: 'artifact';
      proof: 'inline' | 'artifact';
      publicSignals: 'inline' | 'artifact';
    };
    paths: MetaPaths; // <-- use refined type
    hashes?: Partial<{ vkey: string; proof: string; publicSignals: string }>;
  };
};

// -------- Helpers --------

async function readJson<T = unknown>(p: string): Promise<T> {
  const raw = await fs.readFile(p);
  return JSON.parse(raw.toString('utf8')) as T;
}

function resolveArtifactFsPath(bundlePath: string, ref: ArtifactRef): string {
  if (ref.uri && ref.uri.startsWith('file://')) {
    return fileURLToPath(ref.uri);
  }
  if (ref.path) {
    const base = path.dirname(bundlePath);
    return path.resolve(base, ref.path);
  }
  throw new Error('artifact_missing_location');
}

async function assertSha256IfPresent(filePath: string, hash?: Sha256): Promise<void> {
  if (!hash) return;
  if (hash.alg.toLowerCase() !== 'sha256') {
    throw new Error('unsupported_hash_alg');
  }
  const buf = await fs.readFile(filePath);
  const got = crypto.createHash('sha256').update(buf).digest('hex');
  if (got !== hash.value) {
    throw new Error('artifact_hash_mismatch');
  }
}

function jsonSha256(x: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
}

function pickProofFromFile(obj: unknown): unknown {
  // Accept either a raw proof object or a wrapper like { proof, publicSignals }
  if (isObject(obj) && 'proof' in obj) {
    const proof = (obj as Record<string, unknown>)['proof'];
    return proof ?? obj;
  }
  return obj;
}

function pickPublicSignalsFromFile(obj: unknown): unknown {
  // Accept either raw array or wrapper { publicSignals }
  if (Array.isArray(obj)) return obj;
  if (isObject(obj) && 'publicSignals' in obj) {
    return (obj as Record<string, unknown>)['publicSignals'];
  }
  return obj; // let normalizer throw if it's not an array-like we accept
}

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function normalizePublicSignals(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    throw new Error('invalid_public_signals:not_array');
  }
  return (raw as ReadonlyArray<unknown>).map((v, i) => {
    if (typeof v === 'string') {
      // Allow 0x-prefixed hex as well; normalize to decimal string
      if (/^0x/i.test(v)) return BigInt(v).toString(10);
      if (!/^[0-9]+$/.test(v)) {
        // still allow numeric-like strings without leading 0x
        // you can tighten this if your vectors guarantee pure decimals
        return BigInt(v).toString(10);
      }
      return v;
    }
    if (typeof v === 'bigint') {
      return v.toString(10);
    }
    if (typeof v === 'number') {
      if (!Number.isFinite(v) || !Number.isInteger(v)) {
        throw new Error(`invalid_public_signal_number_at_${i}`);
      }
      return BigInt(v).toString(10);
    }
    throw new Error(`invalid_public_signal_type_at_${i}`);
  });
}

// -------- Main loader --------

export async function loadForVerify(bundlePath: string): Promise<LoadedVerifyInputs> {
  const bundle = await readJson<Bundle>(bundlePath);

  // --- vkey (required) from artifacts ---
  const vkeyRef = bundle.artifacts?.vkey;
  if (!vkeyRef) {
    throw new Error('missing_vkey_artifact');
  }
  const vkeyPath = resolveArtifactFsPath(bundlePath, vkeyRef);
  await assertSha256IfPresent(vkeyPath, vkeyRef.hash);
  const vkey = await readJson<unknown>(vkeyPath);

  // --- proof (inline preferred) ---
  let proofSource: 'inline' | 'artifact' = 'inline';
  let proofPath: string | undefined;
  let proofRaw: unknown | undefined = bundle.result?.proof;

  if (proofRaw === undefined) {
    const pref = bundle.artifacts?.proof;
    if (!pref) {
      throw new Error('missing_proof');
    }
    proofPath = resolveArtifactFsPath(bundlePath, pref);
    await assertSha256IfPresent(proofPath, pref.hash);
    const proofFile = await readJson<unknown>(proofPath);
    proofRaw = pickProofFromFile(proofFile);
    proofSource = 'artifact';
  }

  // --- publicSignals (inline preferred) ---
  let publicSource: 'inline' | 'artifact' = 'inline';
  let publicPath: string | undefined;
  let publicRaw: unknown | undefined = bundle.result?.publicSignals;

  if (publicRaw === undefined) {
    const sref = bundle.artifacts?.publicSignals;
    if (!sref) {
      throw new Error('missing_public_signals');
    }
    publicPath = resolveArtifactFsPath(bundlePath, sref);
    await assertSha256IfPresent(publicPath, sref.hash);
    const publicFile = await readJson<unknown>(publicPath);
    publicRaw = pickPublicSignalsFromFile(publicFile);
    publicSource = 'artifact';
  }

  if (proofRaw === undefined || publicRaw === undefined) {
    throw new Error('incomplete_bundle_inputs');
  }

  const publicSignals = normalizePublicSignals(publicRaw);

  // Optional meta for debugging/NDJSON
  const paths: MetaPaths = {
    vkey: vkeyPath,
    ...(proofPath ? { proof: proofPath } : {}),
    ...(publicPath ? { publicSignals: publicPath } : {}),
  };

  const meta: LoadedVerifyInputs['meta'] = {
    sources: {
      vkey: 'artifact',
      proof: proofSource,
      publicSignals: publicSource,
    },
    paths, // <-- no undefined assigned
    hashes: {
      vkey: jsonSha256(vkey),
      proof: jsonSha256(proofRaw),
      publicSignals: jsonSha256(publicSignals),
    },
  };

  return { vkey, proof: proofRaw, publicSignals, meta };
}
