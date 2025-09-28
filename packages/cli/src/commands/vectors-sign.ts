// packages/cli/src/commands/vectors-sign.ts
// Seal an input artifact with Seal V1 (ed25519). ESM/NodeNext, no `any`.

import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import path from 'node:path';
import { createHash, sign as edSign, createPrivateKey, createPublicKey, generateKeyPairSync } from 'node:crypto';
import { keyIdFromSpki } from '@zkpip/core/keys/keyId';
import { isKind, ensureUrnMatchesKind, type Kind } from '@zkpip/core/kind';
import { K } from '@zkpip/core/kind';

// ---------- Types aligned with Seal V1 schema ----------
export type SealV1 = Readonly<{
  version: '1';
  kind: Kind;
  body: unknown;
  seal: Readonly<{
    algo: 'ed25519';
    keyId: string;
    signature: string; // base64
    urn: string;       // urn:zkpip:<kind>:sha256:<hex64>
    signer: string;    // e.g., 'codeseal/1'
    createdAt: string; // ISO8601
  }>;
}>;

export type VectorsSignOptions = Readonly<{
  inFile: string;
  outFile?: string;
  keyDir: string;
  kind?: string; 
}>;

// ---------- Helpers ----------
function sha256Base16(data: Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

function expectedUrnFor(kind: Kind, digestHex: string): string {
  return `urn:zkpip:${kind}:sha256:${digestHex}`;
}

/** Generate an Ed25519 keypair and save as PEM files into keyDir (with legacy aliases). */
async function generateEd25519ToDir(keyDir: string): Promise<{ privPath: string; pubPath: string }> {
  await fsp.mkdir(keyDir, { recursive: true });
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');

  const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
  const pubPem  = publicKey.export({ type: 'spki',  format: 'pem' }) as string;

  // Primary filenames
  const privPrimary = path.join(keyDir, 'signer.key'); // PKCS#8 PEM
  const pubPrimary  = path.join(keyDir, 'signer.pub'); // SPKI PEM

  // Legacy/compat aliases expected by some tests/tools
  const privAlias = path.join(keyDir, 'private.pem');
  const pubAlias  = path.join(keyDir, 'public.pem');

  await Promise.all([
    fsp.writeFile(privPrimary, privPem, 'utf8'),
    fsp.writeFile(pubPrimary,  pubPem,  'utf8'),
    // write aliases too
    fsp.writeFile(privAlias,   privPem, 'utf8'),
    fsp.writeFile(pubAlias,    pubPem,  'utf8'),
  ]);

  return { privPath: privPrimary, pubPath: pubPrimary };
}

/**
 * Loads an Ed25519 keypair from keyDir with fallbacks:
 * - If directory has no keys, auto-generate a new pair (PKCS#8/SPKI in PEM).
 * - Prefer signer.key / signer.pem; else first *.key|*.pem
 * - Public SPKI optional; derive from private if missing.
 * - Accept PEM or DER for either side.
 */
async function loadKeys(keyDir: string): Promise<{ spki: Uint8Array; pkcs8: Uint8Array }> {
  await fsp.mkdir(keyDir, { recursive: true });
  let files = await fsp.readdir(keyDir).catch(() => []);

  if (files.length === 0) {
    await generateEd25519ToDir(keyDir);
    files = await fsp.readdir(keyDir);
  }

  const preferPrivNames = ['signer.key', 'signer.pem', 'private.key', 'private.pem'];
  const preferPubNames  = ['signer.pub', 'public.spki', 'public.der', 'public.pem'];

  // pick private
  let privPath = preferPrivNames.map(n => path.join(keyDir, n)).find(p => fs.existsSync(p));
  if (!privPath) {
    const cand = files.find(f => /\.(key|pem)$/i.test(f));
    if (cand) privPath = path.join(keyDir, cand);
  }
  if (!privPath) {
    // last resort: generate now
    const gen = await generateEd25519ToDir(keyDir);
    privPath = gen.privPath;
  }

  const privRaw = await fsp.readFile(privPath);
  let privateKeyObj;
  try {
    privateKeyObj = createPrivateKey(privRaw); // auto-detect PEM/DER
  } catch {
    privateKeyObj = createPrivateKey({ key: privRaw.toString('utf8'), format: 'pem' });
  }
  const pkcs8Der = privateKeyObj.export({ type: 'pkcs8', format: 'der' }) as Buffer;

  // try public
  let spkiDer: Buffer | null = null;
  let pubPath = preferPubNames.map(n => path.join(keyDir, n)).find(p => fs.existsSync(p));
  if (!pubPath) {
    const cand = files.find(f => /(pub|spki|der|pem)$/i.test(f) && !/\.key$/i.test(f));
    if (cand) pubPath = path.join(keyDir, cand);
  }
  if (pubPath) {
    const pubRaw = await fsp.readFile(pubPath);
    try {
      const pubKeyObj = createPublicKey(pubRaw); // auto-detect
      spkiDer = pubKeyObj.export({ type: 'spki', format: 'der' }) as Buffer;
    } catch {
      try {
        const pubKeyObj = createPublicKey({ key: pubRaw, format: 'der', type: 'spki' });
        spkiDer = pubKeyObj.export({ type: 'spki', format: 'der' }) as Buffer;
      } catch {
        spkiDer = null;
      }
    }
  }
  if (!spkiDer) {
    const pubFromPriv = createPublicKey(privateKeyObj);
    spkiDer = pubFromPriv.export({ type: 'spki', format: 'der' }) as Buffer;
  }

  return { spki: new Uint8Array(spkiDer), pkcs8: new Uint8Array(pkcs8Der) };
}

function signEd25519(pkcs8: Uint8Array, payload: Uint8Array): string {
  // ed25519 ignores the hash param -> pass null
  const key = createPrivateKey({ key: Buffer.from(pkcs8), format: 'der', type: 'pkcs8' });
  const sig = edSign(null, Buffer.from(payload), key);
  return sig.toString('base64');
}

// ---------- Main ----------
export async function runVectorsSign(opts: VectorsSignOptions): Promise<number> {
  try {
    const userKind = opts.kind ?? K.vector;
    if (!isKind(userKind)) {
      console.error(JSON.stringify({ ok: false, code: 15, message: `Unknown kind: ${userKind}` }));
      return 15; // unknown_kind
    }
    const kind = userKind as Kind;

    const rawText = await fs.promises.readFile(opts.inFile, 'utf8');
    const body = JSON.parse(rawText) as unknown;

    // Deterministic payload: raw JSON text bytes (swap to JCS later if needed)
    const payload = new TextEncoder().encode(rawText);
    const digestHex = sha256Base16(payload);

    const urn = expectedUrnFor(kind, digestHex);
    const { spki, pkcs8 } = await loadKeys(opts.keyDir);

    const keyId = keyIdFromSpki(spki, 16);
    const signatureB64 = signEd25519(pkcs8, payload);

    const sealed: SealV1 = {
      version: '1',
      kind,
      body,
      seal: {
        algo: 'ed25519',
        keyId,
        signature: signatureB64,
        urn,
        signer: 'codeseal/1',
        createdAt: new Date().toISOString(),
      },
    };

    // Safety: Kind ↔ URN subject consistency
    ensureUrnMatchesKind(kind, sealed.seal.urn);

    const out = opts.outFile ?? `${opts.inFile}.seal.json`;
    await fs.promises.writeFile(out, JSON.stringify(sealed, null, 2), 'utf8');

    console.log(JSON.stringify({ ok: true, code: 0, out, urn }));
    return 0;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error(JSON.stringify({ ok: false, code: 14, message }));
    return 14; // io_error
  }
}
