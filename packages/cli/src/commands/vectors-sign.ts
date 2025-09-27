// ESM, strict TS, no `any`
// CLI: vectors-sign – refactored to use centralized C14N from @zkpip/core
// Flow: read JSON → canonicalize → sha256 → Ed25519 sign(private.pem) → write sealed artifact
// Notes:
// - Compatible with exactOptionalPropertyTypes
// - Preserves legacy fallback (~/.zkpip/key) and subfolder key discovery
// - English comments only

import * as fs from 'node:fs';
import path from 'node:path';
import { generateKeyPairSync, sign as nodeSign } from 'node:crypto';
import { readdir, mkdir as fspMkdir, writeFile as fspWriteFile, readFile, writeFile } from 'node:fs/promises';
import { prepareBodyDigest, type SealV1 } from '@zkpip/core/seal/v1';
import { JsonValue } from '@zkpip/core/json/c14n';

export type VectorsSignOptions = Readonly<{
  inPath: string;
  outPath: string;
  /** Directory that directly contains private.pem (or a subdir that does). Defaults to ~/.zkpip/key (legacy POC). */
  keyDir?: string | undefined;
  /** Optional URN subject discriminator. Defaults to "vector". */
  kind?: string | undefined;  
}>;

/** Legacy default for POC tests: ~/.zkpip/key */
function legacyDefaultKeyDir(): string {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? '';
  return path.join(home, '.zkpip', 'key');
}

/** Try to find `private.pem` directly in keyDir or in its first subfolder containing it. */
async function resolveKeyPaths(keyDir: string): Promise<{ privPath: string; pubPath: string }> {
  let privPath = path.join(keyDir, 'private.pem');
  let pubPath = path.join(keyDir, 'public.pem');

  if (!fs.existsSync(privPath) && fs.existsSync(keyDir)) {
    const entries = await readdir(keyDir, { withFileTypes: true });
    const sub = entries.find(
      (e) => e.isDirectory() && fs.existsSync(path.join(keyDir, e.name, 'private.pem')),
    );
    if (sub) {
      privPath = path.join(keyDir, sub.name, 'private.pem');
      pubPath = path.join(keyDir, sub.name, 'public.pem');
    }
  }
  return { privPath, pubPath };
}

/** Ensure Ed25519 keypair exists at given paths (generate if missing). */
async function ensureKeypair(privPath: string, pubPath: string): Promise<void> {
  if (fs.existsSync(privPath)) return;
  const dir = path.dirname(privPath);
  await fspMkdir(dir, { recursive: true });
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  await fspWriteFile(privPath, privateKey.export({ type: 'pkcs8', format: 'pem' }) as string, 'utf8');
  await fspWriteFile(pubPath, publicKey.export({ type: 'spki', format: 'pem' }) as string, 'utf8');
}

/** Sign canonical string with Ed25519 (Node supports passing PEM and null for algorithm). */
function signCanonEd25519(canon: string, privPem: string): string {
  const sig = nodeSign(null, Buffer.from(canon, 'utf8'), privPem);
  return sig.toString('base64');
}

export async function runVectorsSign(opts: VectorsSignOptions): Promise<number> {
  const inPath = path.resolve(opts.inPath);
  const outPath = path.resolve(opts.outPath);
  const keyDir = path.resolve(opts.keyDir ?? legacyDefaultKeyDir());
  await fspMkdir(keyDir, { recursive: true });

  const { privPath, pubPath } = await resolveKeyPaths(keyDir);
  await ensureKeypair(privPath, pubPath);

  // 1) Load and parse as JsonValue → this is v1 `body`
  const body = JSON.parse(await readFile(inPath, 'utf8')) as JsonValue;

  // 2–3) Canon + sha256 + URN (subject from kind, default "vector")
  const { canon, expectedUrn } = prepareBodyDigest({ body, kind: opts.kind });

  // 4) Sign canon
  const privPem = await readFile(privPath, 'utf8');
  const signatureB64 = signCanonEd25519(canon, privPem);

  // 5) Compose Seal v1
  const keyId = path.basename(path.dirname(privPath)) === path.basename(keyDir)
    ? path.basename(keyDir)
    : path.basename(path.dirname(privPath));

  const sealed: SealV1 = {
    version: '1',
    kind: opts.kind ?? 'vector',
    body,
    seal: {
      algo: 'ed25519',
      keyId,
      signature: signatureB64,
      urn: expectedUrn,
      signer: 'codeseal/1',
      createdAt: new Date().toISOString(),
    },
  };

  await writeFile(outPath, JSON.stringify(sealed, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify({ ok: true, out: outPath, urn: expectedUrn }));
  return 0;
}
