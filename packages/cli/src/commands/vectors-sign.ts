// packages/cli/src/commands/vectors-sign.ts
// POC sign: canonical JSON → sha256 → Ed25519 sign(private.pem)
// ESM, strict TS, no `any`.

import * as fs from 'node:fs';
import path from 'node:path';
import { createHash, generateKeyPairSync, sign as nodeSign } from 'node:crypto';
import { readdir, mkdir as fspMkdir, writeFile as fspWriteFile, readFile, writeFile } from 'node:fs/promises';

export type VectorsSignOptions = Readonly<{
  inPath: string;
  outPath: string;
  /** Directory that directly contains private.pem. Defaults to ~/.zkpip/key (legacy POC). */
  keyDir?: string;
}>;

function canonicalize(value: unknown): string {
  return _c14n(value);
}
function _c14n(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map((it) => _c14n(it)).join(',')}]`;
  const obj = v as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const body = keys.map((k) => `${JSON.stringify(k)}:${_c14n(obj[k])}`).join(',');
  return `{${body}}`;
}

/** Legacy default for POC tests: ~/.zkpip/key */
function legacyDefaultKeyDir(): string {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? '';
  return path.join(home, '.zkpip', 'key');
}

export async function runVectorsSign(opts: VectorsSignOptions): Promise<number> {
  const inPath = path.resolve(opts.inPath);
  const outPath = path.resolve(opts.outPath);
  const keyDir = path.resolve(opts.keyDir ?? legacyDefaultKeyDir());
  await fspMkdir(keyDir, { recursive: true });

  let privPath = path.join(keyDir, 'private.pem');
  let pubPath  = path.join(keyDir, 'public.pem');  

  if (!fs.existsSync(privPath)) {
    // keystore root? keressünk első almappát private.pem-mel
    if (fs.existsSync(keyDir)) {
      const entries = await readdir(keyDir, { withFileTypes: true });
      const sub = entries.find(e => e.isDirectory() && fs.existsSync(path.join(keyDir, e.name, 'private.pem')));
      if (sub) {
        privPath = path.join(keyDir, sub.name, 'private.pem');
        pubPath  = path.join(keyDir, sub.name, 'public.pem');
      }
    }
  }

  if (!fs.existsSync(privPath)) {
    // POC fallback: generáljunk kulcspárt közvetlenül keyDir alá
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    await fspMkdir(keyDir, { recursive: true });
    await fspWriteFile(privPath, privateKey.export({ type: 'pkcs8', format: 'pem' }) as string, 'utf8');
    await fspWriteFile(pubPath,  publicKey.export({ type: 'spki',  format: 'pem' }) as string, 'utf8');
  }

  const vector = JSON.parse(await readFile(inPath, 'utf8')) as unknown;
  const canon = canonicalize(vector);

  const idHex = createHash('sha256').update(canon, 'utf8').digest('hex');
  const signatureB64 = nodeSign(null, Buffer.from(canon, 'utf8'), fs.readFileSync(privPath, 'utf8')).toString('base64');

  // POC sealed format (legacy-kompat).
  const keyId = path.basename(keyDir);
  const urn = `urn:zkpip:vector:sha256:${idHex}`;

  const sealed = {
    vector, // <-- a teljes bemenő objektum
    seal: {
      signer: 'codeseal/0',           // POC 
      algo: 'ed25519' as const,
      id: idHex,
      urn,                            
      keyId,                          
      signature: signatureB64,
    },
  };

  await writeFile(outPath, JSON.stringify(sealed, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify({ ok: true, out: outPath }));
  return 0;
}
