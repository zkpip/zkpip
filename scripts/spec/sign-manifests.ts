// scripts/spec/sign-manifests.ts
// ESM, strict TS, no "any".
// Detached Ed25519 signer for *.manifest.json using Node WebCrypto (no noble).

import 'dotenv/config';
import { webcrypto } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { jcsCanonicalize, type Json } from './jcs.js';

// ---- base64url helpers ----
const b64uToBytes = (s: string): Uint8Array => new Uint8Array(Buffer.from(s.trim(), 'base64url'));
const bytesToB64u = (b: ArrayBuffer | Uint8Array): string =>
  Buffer.from(b instanceof Uint8Array ? b : new Uint8Array(b)).toString('base64url');

// ---- PKCS#8 builder for Ed25519 from 32-byte seed ----
// DER header: 30 2e 02 01 00 30 05 06 03 2B 65 70 04 22 04 20 || <32 bytes seed>
function ed25519Pkcs8FromSeed(seed: Uint8Array): Uint8Array {
  if (seed.length !== 32) throw new Error(`Expected 32-byte seed, got ${seed.length}`);
  const header = Uint8Array.from([
    0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20,
  ]);
  const out = new Uint8Array(header.length + 32);
  out.set(header, 0);
  out.set(seed, header.length);
  return out;
}

// Try JWK import first (d + optional x). If it fails, fall back to PKCS#8(seed).
async function importEd25519PrivateKey(skB64u: string, xB64u?: string) {
  const raw = b64uToBytes(skB64u);
  const seed = raw.length === 32 ? raw : raw.length === 64 ? raw.subarray(0, 32) : undefined;
  if (!seed) throw new Error(`Invalid Ed25519 secret length: got ${raw.length}, expected 32 or 64`);

  const jwkPriv: Record<string, unknown> = {
    kty: 'OKP',
    crv: 'Ed25519',
    d: bytesToB64u(seed),
    ext: true,
  };
  if (xB64u && xB64u.trim().length > 0) jwkPriv.x = xB64u.trim();

  try {
    return await webcrypto.subtle.importKey('jwk', jwkPriv, { name: 'Ed25519' }, false, ['sign']);
  } catch {
    const pkcs8 = ed25519Pkcs8FromSeed(seed);
    return await webcrypto.subtle.importKey('pkcs8', pkcs8, { name: 'Ed25519' }, false, ['sign']);
  }
}

async function signEd25519Detached(
  msg: Uint8Array,
  skB64u: string,
  xB64u?: string,
): Promise<string> {
  const key = await importEd25519PrivateKey(skB64u, xB64u);
  const sig = await webcrypto.subtle.sign('Ed25519', key, msg);
  return bytesToB64u(sig);
}

async function loadJsonFile<T extends Json>(p: string): Promise<T> {
  const raw = await fs.readFile(p, 'utf8');
  return JSON.parse(raw) as T;
}

async function main(): Promise<void> {
  // args
  const args = new Map<string, string>();
  for (let i = 2; i < process.argv.length; i += 2) {
    const k = process.argv[i]?.replace(/^--/, '');
    const v = process.argv[i + 1];
    if (k && v) args.set(k, v);
  }

  const dir = args.get('dir') ?? 'docs/spec/examples/canvectors';
  const kid = args.get('kid') ?? 'dev-1';

  // signing key
  const skB64u = process.env.ZKPIP_DEV_ED25519_SK_B64URL ?? args.get('sk_b64url') ?? '';
  if (!skB64u) {
    console.error('Missing signing key. Set ZKPIP_DEV_ED25519_SK_B64URL or pass --sk_b64url.');
    process.exit(2);
  }
  if (b64uToBytes(skB64u).length !== 32) {
    console.error('Ed25519 private key (d) must be 32 bytes (base64url).');
    process.exit(2);
  }

  // list manifests
  const files: string[] = [];
  for (const ent of await fs.readdir(dir, { withFileTypes: true })) {
    if (ent.isFile() && ent.name.endsWith('.manifest.json')) files.push(path.join(dir, ent.name));
  }
  files.sort();
  if (files.length === 0) {
    console.error(`No *.manifest.json found in ${dir}`);
    process.exit(1);
  }

  let ok = 0;
  for (const mf of files) {
    const obj = await loadJsonFile<Json>(mf);

    // optional sanity: has kid?
    const hasKid = typeof (obj as { readonly kid?: unknown }).kid === 'string';
    if (!hasKid) console.warn(`⚠️  manifest '${path.basename(mf)}' has no "kid" field`);

    // *** single source of truth: shared JCS ***
    const canon = jcsCanonicalize(obj);
    const msg = new TextEncoder().encode(canon);
    const sigB64u = await signEd25519Detached(msg, skB64u);

    const out = mf.replace(/\.manifest\.json$/i, '.manifest.sig');
    await fs.writeFile(out, `${sigB64u}\n`, 'utf8');
    console.log(`signed: ${path.basename(mf)} → ${path.basename(out)}`);
    ok++;
  }

  console.log(`\n✅ Signed ${ok} manifest(s). kid=${kid}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
