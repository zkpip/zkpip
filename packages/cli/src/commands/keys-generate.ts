// ZKPIP CLI — keys generate
// ESM, strict TS, Node 22+, no `any`.
// - Generates Ed25519 keypair
// - Derives keyId = base32lower(no pad, 20ch) from sha256(SPKI)
// - Writes: <outDir>/<keyId>/{private.pem, public.pem, key.json}
// - Updates: <outDir>/keys.index.json (reverse lookup)
// - Prints machine-readable JSON

import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import { generateKeyPairSync } from 'node:crypto';
import { keyIdFromSpki, spkiSha256Hex } from '@zkpip/core/keys/keyId';
import { upsertKeyIndex } from '../utils/keystore-index.js';

export type KeysGenerateOptions = Readonly<{
  outDir: string;              // keystore root (required)
  label?: string;              // optional human-friendly label
  keyId?: string;              // optional override; must match derived
  json?: boolean;              // force JSON output (default: pretty text on TTY)
}>;

type Ok = Readonly<{
  ok: true;
  keyId: string;
  dir: string;
  alg: 'ed25519';
  createdAt: string;
}>;

type Err = Readonly<{
  ok: false;
  code: number;
  error: string;
  message: string;
}>;

function emit(out: Ok | Err, forceJson: boolean): void {
  if (forceJson || !out.ok) {
    console.log(JSON.stringify(out));
    return;
  }
  // human-friendly
  console.log(`✅ Generated key ${out.keyId}`);
  console.log(`   Dir: ${out.dir}`);
}

export async function runKeysGenerate(opts: KeysGenerateOptions): Promise<number> {
  const root = path.resolve(opts.outDir);
  const forceJson = Boolean(opts.json);

  try {
    await fsp.mkdir(root, { recursive: true });

    // 1) Generate Ed25519
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;

    const spkiDer = publicKey.export({ type: 'spki', format: 'der' }) as Buffer;
    const pubPem  = publicKey.export({ type: 'spki', format: 'pem' }) as string;

    // 2) Derive identifiers
    const derivedKid = keyIdFromSpki(new Uint8Array(spkiDer));
    const sha = spkiSha256Hex(new Uint8Array(spkiDer));
    const createdAt = new Date().toISOString();

    // Accept user-provided keyId for directory/layout compatibility.
    // If it differs from the derivedKid, proceed with a warning (non-JSON mode).
    const kid = opts.keyId ?? derivedKid;
    if (opts.keyId && opts.keyId !== derivedKid && !opts.json) {
      console.error(
        `[warn] Provided keyId "${opts.keyId}" differs from derived "${derivedKid}" (spki/sha256). ` +
        `Proceeding with keyId="${kid}".`
      );
    }

    // 3) Write files
    const dir = path.join(root, kid);
    await fsp.mkdir(dir, { recursive: true });

    await Promise.all([
      fsp.writeFile(path.join(dir, 'private.pem'), privPem, 'utf8'),
      fsp.writeFile(path.join(dir, 'public.pem'),  pubPem,  'utf8'),
      fsp.writeFile(
        path.join(dir, 'key.json'),
        JSON.stringify(
          {
            keyId: kid,                // <- a választott (user vagy derived)
            algo: 'ed25519',
            spkiSha256: sha,
            createdAt,
            ...(opts.label ? { label: opts.label } : {}),
            derivedKeyId: derivedKid,  // opcionális, hasznos diagnosztika
          },
          null,
          2
        ) + '\n',
        'utf8'
      ),
    ]);

    // 4) Update reverse index (keyId → entry)
    await upsertKeyIndex(root, {
      keyId: kid,       // <- a választott (user vagy derived)
      dir: kid,
      alg: 'ed25519',
      createdAt,
      ...(opts.label ? { label: opts.label } : {}),
      spkiSha256: sha,
    });

    const ok: Ok = { ok: true, keyId: kid, dir, alg: 'ed25519', createdAt };
    emit(ok, forceJson);
    return 0;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const err: Err = { ok: false, code: 4, error: 'KEYGEN_FAILED', message: msg };
    emit(err, true);
    return 4;
  }
}
