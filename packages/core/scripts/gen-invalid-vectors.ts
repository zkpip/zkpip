// Generate invalid vectors from a known-good Groth16 bundle, with safety guards.
// - English comments
// - No `any`
// - ESM + NodeNext friendly (use: `tsx packages/core/scripts/gen-invalid-vectors.ts`)
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFile } from '../src/utils/fs-compat.js';

// ---------- Immutable JSON types (for reading) ----------
type JSONPrimitive = string | number | boolean | null;
type JSONValue = JSONPrimitive | JSONObject | JSONArray;
type JSONArray = ReadonlyArray<JSONValue>;
type JSONObject = { readonly [k: string]: JSONValue };

// ---------- Mutable JSON types (for controlled writes in this generator) ----------
type MutableJSONPrimitive = JSONPrimitive;
type MutableJSONValue = MutableJSONPrimitive | MutableJSONObject | MutableJSONArray;
export type MutableJSONArray = MutableJSONValue[];
type MutableJSONObject = { [k: string]: MutableJSONValue };

// ---------- Type guards ----------
const isMutableObject = (v: unknown): v is MutableJSONObject =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const isTwoDimStringArray = (v: unknown): v is string[][] =>
  Array.isArray(v) &&
  v.every((row) => Array.isArray(row) && row.every((x) => typeof x === 'string'));

// ---------- FS helpers ----------
async function readJson<T>(fp: string): Promise<T> {
  const raw = await fs.readFile(fp, 'utf8');
  return JSON.parse(raw) as T;
}
async function writeJson(fp: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(fp), { recursive: true });
  await writeFile(fp, JSON.stringify(data, null, 2));
}
async function fileExists(fp: string): Promise<boolean> {
  try {
    await fs.access(fp);
    return true;
  } catch {
    return false;
  }
}

// ---------- Safety guards ----------
function assertUnderDir(fp: string, mustContain: 'valid' | 'invalid'): void {
  const norm = fp.replace(/\\/g, '/');
  if (!norm.includes(`/${mustContain}/`)) {
    throw new Error(`Refusing to write outside '${mustContain}/': ${fp}`);
  }
}
function deepFreezeUnknown(o: unknown): void {
  if (o === null || typeof o !== 'object') return;
  if (Array.isArray(o)) {
    for (const item of o) deepFreezeUnknown(item);
    Object.freeze(o);
    return;
  }
  const obj = o as { readonly [k: string]: unknown };
  for (const key of Object.keys(obj)) deepFreezeUnknown(obj[key]);
  Object.freeze(o);
}
function deepFreeze<T>(obj: T): T {
  deepFreezeUnknown(obj);
  return obj;
}
async function sha256File(fp: string): Promise<string> {
  const h = createHash('sha256');
  h.update(await fs.readFile(fp));
  return h.digest('hex');
}

// ---------- Clone to a mutable structure ----------
function cloneMutable<T extends JSONObject>(v: T): MutableJSONObject {
  return JSON.parse(JSON.stringify(v)) as MutableJSONObject;
}

// ---------- Paths ----------
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');

const VECTORS_ROOT = path.join(
  ROOT,
  'packages/core/schemas/tests/vectors/mvs/verification/snarkjs-groth16',
);
const VALID_DIR = path.join(VECTORS_ROOT, 'valid');
const INVALID_DIR = path.join(VECTORS_ROOT, 'invalid');

// Try common locations for the base valid bundle
const SRC_VALID_CANDIDATES = [
  path.join(VALID_DIR, 'proof-envelope.valid.json'),
  path.join(ROOT, 'packages/core/schemas/tests/vectors/mvs/verification/proof-envelope.valid.json'),
];

async function pickBaseValid(): Promise<string> {
  for (const cand of SRC_VALID_CANDIDATES) {
    if (await fileExists(cand)) return cand;
  }
  throw new Error(`Base valid bundle not found. Checked:\n- ${SRC_VALID_CANDIDATES.join('\n- ')}`);
}

async function main(): Promise<void> {
  const srcValid = await pickBaseValid();

  // Freeze + hash guard to ensure the source never changes
  const base = await readJson<JSONObject>(srcValid);
  deepFreeze(base);
  const srcHashBefore = await sha256File(srcValid);

  // VALID expect (subset only)
  {
    const out = path.join(VALID_DIR, 'proof-envelope.valid.expect.json');
    assertUnderDir(out, 'valid');
    await writeJson(out, { ok: true, adapter: 'snarkjs-groth16' });
  }

  // Also copy the base valid bundle into adapter-specific 'valid/'
  // so Stage 1 has a real positive test case.
  {
    const outValid = path.join(VALID_DIR, 'proof-envelope.valid.json');
    assertUnderDir(outValid, 'valid');
    await writeJson(outValid, base); // 'base' is the frozen original valid bundle
  }

  // =========== A) publicSignals[0] + 1 ===========
  {
    const m = cloneMutable(base);
    const result = isMutableObject(m['result']) ? m['result'] : null;
    const pub =
      result && Array.isArray(result['publicSignals'])
        ? (result['publicSignals'] as MutableJSONArray)
        : null;

    if (pub && typeof pub[0] === 'string') {
      const inc = (BigInt(pub[0]) + 1n).toString();
      result!['publicSignals'] = [inc, ...pub.slice(1)];
    }

    const f = path.join(INVALID_DIR, 'proof-envelope.public-mutation.json');
    assertUnderDir(f, 'invalid');
    await writeJson(f, m);

    const e = path.join(INVALID_DIR, 'proof-envelope.public-mutation.expect.json');
    assertUnderDir(e, 'invalid');
    await writeJson(e, { ok: false, adapter: 'snarkjs-groth16', error: 'verification_failed' });
  }

  // =========== B) proof.pi_a[0] last digit tweak ===========
  {
    const m = cloneMutable(base);
    const result = isMutableObject(m['result']) ? m['result'] : null;
    const proof =
      result && isMutableObject(result['proof']) ? (result['proof'] as MutableJSONObject) : null;
    const pi_a = proof && Array.isArray(proof['pi_a']) ? (proof['pi_a'] as MutableJSONArray) : null;

    if (pi_a && typeof pi_a[0] === 'string') {
      const s = pi_a[0];
      const last = s.slice(-1);
      const newLast = last !== '0' ? '0' : '1';
      (pi_a as MutableJSONArray)[0] = s.slice(0, -1) + newLast;
    }

    const f = path.join(INVALID_DIR, 'proof-envelope.proof-bitflip.json');
    assertUnderDir(f, 'invalid');
    await writeJson(f, m);

    const e = path.join(INVALID_DIR, 'proof-envelope.proof-bitflip.expect.json');
    assertUnderDir(e, 'invalid');
    await writeJson(e, { ok: false, adapter: 'snarkjs-groth16', error: 'verification_failed' });
  }

  // =========== C) proof.pi_c[0] last digit tweak ===========
  {
    const m = cloneMutable(base);
    const result = isMutableObject(m['result']) ? m['result'] : null;
    const proof =
      result && isMutableObject(result['proof']) ? (result['proof'] as MutableJSONObject) : null;
    const pi_c = proof && Array.isArray(proof['pi_c']) ? (proof['pi_c'] as MutableJSONArray) : null;

    if (pi_c && typeof pi_c[0] === 'string') {
      const s = pi_c[0];
      const last = s.slice(-1);
      const newLast = last !== '0' ? '0' : '1';
      (pi_c as MutableJSONArray)[0] = s.slice(0, -1) + newLast;
    }

    const f = path.join(INVALID_DIR, 'proof-envelope.proof-pi_c-bitflip.json');
    assertUnderDir(f, 'invalid');
    await writeJson(f, m);

    const e = path.join(INVALID_DIR, 'proof-envelope.proof-pi_c-bitflip.expect.json');
    assertUnderDir(e, 'invalid');
    await writeJson(e, { ok: false, adapter: 'snarkjs-groth16', error: 'verification_failed' });
  }

  // =========== D) proof.pi_b[0][0] last digit tweak ===========
  {
    const m = cloneMutable(base);
    const result = isMutableObject(m['result']) ? m['result'] : null;
    const proof =
      result && isMutableObject(result['proof']) ? (result['proof'] as MutableJSONObject) : null;
    const pi_b = proof && Array.isArray(proof['pi_b']) ? (proof['pi_b'] as MutableJSONArray) : null;

    if (pi_b && isTwoDimStringArray(pi_b)) {
      const firstRow = pi_b[0];
      if (firstRow && typeof firstRow[0] === 'string') {
        const s = firstRow[0];
        const last = s.slice(-1);
        const newLast = last !== '0' ? '0' : '1';
        (pi_b[0] as MutableJSONArray)[0] = s.slice(0, -1) + newLast;
      }
    }

    const f = path.join(INVALID_DIR, 'proof-envelope.proof-pi_b-bitflip.json');
    assertUnderDir(f, 'invalid');
    await writeJson(f, m);

    const e = path.join(INVALID_DIR, 'proof-envelope.proof-pi_b-bitflip.expect.json');
    assertUnderDir(e, 'invalid');
    await writeJson(e, { ok: false, adapter: 'snarkjs-groth16', error: 'verification_failed' });
  }

  // Ensure source file integrity
  const srcHashAfter = await sha256File(srcValid);
  if (srcHashAfter !== srcHashBefore) {
    throw new Error('Source bundle modified unexpectedly!');
  }

  console.log('Generated vectors under:', VECTORS_ROOT);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(2);
});
