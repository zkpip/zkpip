// packages/core/scripts/make-bundles-from-local.mjs
// ESM only – Node 18+
// Kimenet: proof-envelope.valid.json és proof-envelope.invalid.json (+ invalid proof/public fájlok)
// Kötelező inputok a --dir mappában: verification_key.json (vagy vkey.json), proof.json, public.json
// Opcionális: *.wasm, *.zkey, circuit.circom

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { writeFile, mkdir } from '#fs-compat';

// ---------- helpers ----------
function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dir') out.dir = argv[++i];
    else if (a === '--out') out.out = argv[++i];
  }
  if (!out.dir || !out.out) {
    console.error('Usage: node make-bundles-from-local.mjs --dir <srcDir> --out <outDir>');
    process.exit(2);
  }
  return out;
}
async function readJson(p) {
  return JSON.parse(await fsp.readFile(p, 'utf8'));
}
function exists(p) {
  return fs.existsSync(p);
}
function fileUri(absPath) {
  return pathToFileURL(absPath).toString();
}
function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}
function uuid() {
  return (
    crypto.randomUUID?.() ??
    [...crypto.randomBytes(16)]
      .map((b, i) =>
        (i === 6 ? (b & 0x0f) | 0x40 : i === 8 ? (b & 0x3f) | 0x80 : b)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}
function firstMatch(dir, patterns, fallbacks = []) {
  const entries = fs.readdirSync(dir);
  for (const pat of patterns) {
    const found = entries.find((f) => f.toLowerCase().endsWith(pat.toLowerCase()));
    if (found) return path.join(dir, found);
  }
  for (const fb of fallbacks) {
    const p = path.join(dir, fb);
    if (exists(p)) return p;
  }
  return null;
}
function artifactMeta(absPath, mediaType = 'application/octet-stream') {
  const stat = fs.statSync(absPath);
  const buf = fs.readFileSync(absPath);
  return {
    path: absPath, // abszolút path (loader barát)
    uri: fileUri(absPath), // file:// URI (biztos feloldás)
    size: stat.size,
    mediaType,
    hash: { alg: 'sha256', value: sha256(buf) },
  };
}
async function writeJsonPretty(absPath, obj) {
  await mkdir(path.dirname(absPath), { recursive: true });
  await writeFile(absPath, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

// Biztos „meghamisítás”: keresünk az objektumban egy szám-stringet és +1
function bumpFirstNumericStringDeep(obj) {
  let done = false;
  const bump = (v) => {
    if (done) return v;
    if (typeof v === 'string') {
      if (/^-?\d+$/.test(v)) {
        done = true;
        return (BigInt(v) + 1n).toString();
      }
      if (/^0x[0-9a-fA-F]+$/.test(v)) {
        // hex: utolsó nibble flip (nem 'f'→'0')
        const hex = v.slice(2);
        const last = hex.slice(-1);
        const flipped = last.toLowerCase() === 'f' ? '0' : (parseInt(last, 16) ^ 1).toString(16);
        done = true;
        return '0x' + hex.slice(0, -1) + flipped;
      }
    } else if (typeof v === 'number' && Number.isFinite(v)) {
      done = true;
      return v + 1;
    } else if (Array.isArray(v)) {
      return v.map((x) => bump(x));
    } else if (v && typeof v === 'object') {
      for (const k of Object.keys(v)) {
        v[k] = bump(v[k]);
        if (done) break;
      }
      return v;
    }
    return v;
  };
  return bump(structuredClone(obj));
}

// ---------- main ----------
async function main() {
  const { dir, out } = parseArgs(process.argv);

  // Kötelező inputok
  const vkeyPath = [path.join(dir, 'verification_key.json'), path.join(dir, 'vkey.json')].find(
    exists,
  );
  const proofPath = path.join(dir, 'proof.json');
  const publicPath = path.join(dir, 'public.json');

  if (!vkeyPath) {
    console.error('Missing verification_key.json (or vkey.json) in', dir);
    process.exit(4);
  }
  if (!exists(proofPath)) {
    console.error('Missing', proofPath);
    process.exit(4);
  }
  if (!exists(publicPath)) {
    console.error('Missing', publicPath);
    process.exit(4);
  }

  // Opcionális
  const cirPath = exists(path.join(dir, 'circuit.circom'))
    ? path.join(dir, 'circuit.circom')
    : null;
  const wasmPath = firstMatch(dir, ['.wasm'], ['circuit.wasm']);
  const zkeyPath = firstMatch(dir, ['.zkey'], ['circuit_final.zkey', 'circuit_0000.zkey']);
  if (!wasmPath) {
    console.error('Missing WASM (e.g., circuit.wasm) in', dir);
    process.exit(4);
  }
  if (!zkeyPath) {
    console.error('Missing ZKEY (e.g., circuit_final.zkey) in', dir);
    process.exit(4);
  }

  // Tartalmak
  const vkey = await readJson(vkeyPath);
  const proofRaw = await readJson(proofPath);
  const publicArray = await readJson(publicPath);

  const proofHasWrapper =
    typeof proofRaw === 'object' && ('proof' in proofRaw || 'publicSignals' in proofRaw);
  const proofObj = proofHasWrapper ? proofRaw.proof : proofRaw;
  const publicSignals = Array.isArray(proofRaw?.publicSignals)
    ? proofRaw.publicSignals
    : Array.isArray(publicArray)
      ? publicArray
      : [];

  if (!Array.isArray(publicSignals) || publicSignals.length === 0) {
    console.error('publicSignals missing/empty (from proof.json or public.json)');
    process.exit(4);
  }

  // Meta
  const program = { language: 'circom', entry: cirPath ? 'circuit.circom' : 'unknown' };
  const curve = typeof vkey?.curve === 'string' ? vkey.curve : 'bn128';

  const base = {
    envelopeId: `urn:uuid:${uuid()}`,
    schemaVersion: '0.1.0',
    proofSystem: 'groth16',
    curve,
    prover: 'snarkjs',
    program,
  };

  // Artifacts (VALID) – az eredeti fájlokra mutatnak
  const artifactsValid = {
    vkey: artifactMeta(vkeyPath, 'application/json'),
    proof: artifactMeta(proofPath, 'application/json'),
    publicSignals: artifactMeta(publicPath, 'application/json'),
    wasm: artifactMeta(wasmPath, 'application/wasm'),
    zkey: artifactMeta(zkeyPath, 'application/octet-stream'),
  };

  // VALID bundle – inline result is
  const valid = {
    ...base,
    artifacts: artifactsValid,
    result: { proof: structuredClone(proofObj), publicSignals: structuredClone(publicSignals) },
  };

  // INVALID bundle előkészítés: módosítunk publicSignals-t és a proof-ból is 1 számot
  const invalidPublic = structuredClone(publicSignals);
  if (invalidPublic.length > 0) {
    // +1 az első numeric elemre (hexet is kezeljük)
    for (let i = 0; i < invalidPublic.length; i++) {
      const v = invalidPublic[i];
      if (typeof v === 'string' && /^-?\d+$/.test(v)) {
        invalidPublic[i] = (BigInt(v) + 1n).toString();
        break;
      }
      if (typeof v === 'string' && /^0x[0-9a-fA-F]+$/.test(v)) {
        const hex = v.slice(2);
        const last = hex.slice(-1);
        invalidPublic[i] = '0x' + hex.slice(0, -1) + (parseInt(last, 16) ^ 1).toString(16);
        break;
      }
      if (typeof v === 'number' && Number.isFinite(v)) {
        invalidPublic[i] = v + 1;
        break;
      }
    }
  }

  const invalidProof = bumpFirstNumericStringDeep(proofObj);

  // Kiírjuk az INVALID-hoz tartozó fájlokat az out mappába
  const invalidPublicPath = path.join(out, 'public.invalid.json');
  const invalidProofPath = path.join(out, 'proof.invalid.json');

  // proof.json eredeti fájl formátuma lehet wrapperes -> tartsuk meg
  const invalidProofFileContent = proofHasWrapper
    ? { ...structuredClone(proofRaw), proof: structuredClone(invalidProof) }
    : structuredClone(invalidProof);

  await writeJsonPretty(invalidPublicPath, invalidPublic);
  await writeJsonPretty(invalidProofPath, invalidProofFileContent);

  // Artifacts (INVALID) – proof/publicSignals átirányítva az új fájlokra
  const artifactsInvalid = {
    ...artifactsValid,
    proof: artifactMeta(invalidProofPath, 'application/json'),
    publicSignals: artifactMeta(invalidPublicPath, 'application/json'),
  };

  const invalid = {
    ...base,
    envelopeId: `urn:uuid:${uuid()}`, // <<< ÚJ ID MINDIG az invalidnak
    artifacts: artifactsInvalid,
    result: { proof: invalidProof, publicSignals: invalidPublic },
  };

  // Írás
  await fsp.mkdir(out, { recursive: true });
  const validOut = path.join(out, 'proof-envelope.valid.json');
  const invalidOut = path.join(out, 'proof-envelope.invalid.json');

  await writeJsonPretty(validOut, valid);
  await writeJsonPretty(invalidOut, invalid);

  console.log('Wrote:');
  console.log('  ', validOut);
  console.log('  ', invalidOut);
  console.log('  ', invalidProofPath);
  console.log('  ', invalidPublicPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
