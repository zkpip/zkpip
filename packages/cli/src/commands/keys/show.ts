// ZKPIP CLI — keys show (non-yargs runner, permissive resolution)
// ESM, strict TS, no `any`.

import * as fs from 'node:fs';
import * as path from 'node:path';
import { defaultStoreRoot } from '../../utils/keystore.js';

export type KeysShowOptions = Readonly<{
  keyId: string;
  store?: string;
  json?: boolean;
}>;

type Ok = Readonly<{
  ok: true;
  keyId: string;
  alg: 'ed25519';
  publicPemPath: string;
  publicPem?: string;
  createdAt?: string | null;
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
  } else {
    // plain mode: csak a PEM-et írjuk ki STDOUT-ra (visszafelé kompatibilis)
    if (out.ok && typeof out.publicPem === 'string') {
      console.log(out.publicPem);
    } else {
      console.log('');
    }
  }
}

/** Permisszív public.pem feloldás – ugyanaz a logika mint verify-seal-ben. */
function resolvePublicPem(baseDir: string, keyId: string): string | null {
  const candidates: string[] = [
    path.join(baseDir, 'public.pem'),
    path.join(baseDir, `${keyId}.pub.pem`),
    path.join(baseDir, 'ed25519', keyId, 'public.pem'),
    path.join(baseDir, keyId, 'public.pem'),
    path.join(baseDir, 'ed25519', `${keyId}.pub.pem`),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  // utolsó próbálkozás: bejárjuk a közvetlen almappákat és nézzük a "<dir>/public.pem"-et
  if (fs.existsSync(baseDir)) {
    const entries = fs.readdirSync(baseDir, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const p = path.join(baseDir, e.name, 'public.pem');
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

/** Megpróbál meta-t olvasni ugyanabból a könyvtárból, ha van. */
function tryReadCreatedAtFromMeta(publicPemPath: string): string | null {
  const dir = path.dirname(publicPemPath);
  const metaPath = path.join(dir, 'key.json');
  try {
    if (fs.existsSync(metaPath)) {
      const raw = fs.readFileSync(metaPath, 'utf8');
      const json = JSON.parse(raw) as unknown;
      if (json && typeof json === 'object' && !Array.isArray(json)) {
        const ca = (json as { createdAt?: unknown }).createdAt;
        if (typeof ca === 'string' && ca.length > 0) return ca;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

export async function runKeysShow(opts: KeysShowOptions): Promise<number> {
  const store = opts.store ?? defaultStoreRoot();
  const forceJson = Boolean(opts.json);

  try {
    const pubPath = resolvePublicPem(store, opts.keyId);
    if (!pubPath) {
      const err: Err = {
        ok: false,
        code: 1,
        error: 'PUBLIC_PEM_NOT_FOUND',
        message: `Public key not found under "${store}" for keyId="${opts.keyId}"`,
      };
      emit(err, true);
      return 1;
    }

    const pem = fs.readFileSync(pubPath, 'utf8');
    const createdAt = tryReadCreatedAtFromMeta(pubPath);

    const ok: Ok = {
      ok: true,
      keyId: opts.keyId,
      alg: 'ed25519',
      publicPemPath: pubPath,
      ...(forceJson ? { publicPem: pem, createdAt } : {}),
    };
    emit(ok, forceJson);
    return 0;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const err: Err = { ok: false, code: 1, error: 'PUBLIC_PEM_READ_FAILED', message: msg };
    emit(err, true);
    return 1;
  }
}
