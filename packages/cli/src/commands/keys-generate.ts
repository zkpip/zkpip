import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import { generateKeyPairSync, createPublicKey } from 'node:crypto';
import { keyIdFromSpki, spkiSha256Hex } from '@zkpip/core/keys/keyId';
import { upsertKeyIndex } from '../utils/keystore-index.js';

export type KeysGenerateOptions = Readonly<{
  outDir: string; // keystore root
}>;

export async function runKeysGenerate(opts: KeysGenerateOptions): Promise<number> {
  const root = path.resolve(opts.outDir);
  await fsp.mkdir(root, { recursive: true });

  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
  const spkiDer = createPublicKey(publicKey).export({ type: 'spki', format: 'der' }) as Buffer;
  const pubPem  = createPublicKey(publicKey).export({ type: 'spki', format: 'pem' }) as string;

  const kid = keyIdFromSpki(new Uint8Array(spkiDer));
  const sha = spkiSha256Hex(new Uint8Array(spkiDer));
  const createdAt = new Date().toISOString();

  const dir = path.join(root, kid);
  await fsp.mkdir(dir, { recursive: true });

  await Promise.all([
    fsp.writeFile(path.join(dir, 'private.pem'), privPem, 'utf8'),
    fsp.writeFile(path.join(dir, 'public.pem'),  pubPem,  'utf8'),
    fsp.writeFile(path.join(dir, 'key.json'),
      JSON.stringify({ keyId: kid, algo: 'ed25519', spkiSha256: sha, createdAt }, null, 2) + '\n',
      'utf8'),
  ]);

  await await upsertKeyIndex(root, { keyId: kid, dir: kid, alg: 'ed25519', spkiSha256: sha, createdAt });

  console.log(JSON.stringify({ ok: true, keyId: kid, dir }));
  return 0;
}
