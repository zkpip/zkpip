// Keystore resolver utilities (ESM, strict TS, no `any`).
// Centralizes key directory discovery for both CLI commands and vectors-cli.
// Layout-agnostic, with multiple fallbacks and optional meta matching.

import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import path from 'node:path';

export type KeyDirRecord = Readonly<{
  dir: string;
  privatePemPath: string;
  publicPemPath: string | null;
  metaPath: string | null;
  metaKid: string | null; // could be 'kid' | 'keyId' | 'label' from meta
}>;

/** Scan a keystore root for key directories containing a private.pem. */
export async function listKeyDirs(storeRoot: string): Promise<ReadonlyArray<KeyDirRecord>> {
  const entries = await fsp.readdir(storeRoot, { withFileTypes: true }).catch(() => []);
  const out: KeyDirRecord[] = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const dir = path.join(storeRoot, e.name);
    const privatePemPath = path.join(dir, 'private.pem');
    if (!fs.existsSync(privatePemPath)) continue;

    const publicPemPath = fs.existsSync(path.join(dir, 'public.pem')) ? path.join(dir, 'public.pem') : null;

    // try discover meta
    const metaCandidates = ['key.meta.json', 'meta.json', 'key.json'].map((f) => path.join(dir, f));
    let metaPath: string | null = null;
    let metaKid: string | null = null;

    for (const mp of metaCandidates) {
      if (!fs.existsSync(mp)) continue;
      metaPath = mp;
      try {
        const raw = await fsp.readFile(mp, 'utf8');
        const parsed = JSON.parse(raw) as unknown;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const o = parsed as { kid?: unknown; keyId?: unknown; label?: unknown };
          metaKid =
            (typeof o.kid === 'string' && o.kid) ||
            (typeof o.keyId === 'string' && o.keyId) ||
            (typeof o.label === 'string' && o.label) ||
            null;
        }
      } catch {
        // ignore parse errors; keep metaKid null
      }
      break; // first existing meta file is used
    }

    out.push({ dir, privatePemPath, publicPemPath, metaPath, metaKid });
  }
  return out;
}

/** Resolve a private key path by `keyId` with multiple fallbacks (meta → dir name → single key). */
export async function resolvePrivateKeyPath(storeRoot: string, keyId: string): Promise<string | null> {
  // direct patterns (kept for legacy/layout variants)
  const direct = [
    path.join(storeRoot, 'ed25519', keyId, 'private.pem'),
    path.join(storeRoot, keyId, 'private.pem'),
    path.join(storeRoot, 'ed25519', `${keyId}.pem`),
  ];
  for (const p of direct) {
    if (fs.existsSync(p)) return p;
  }

  const dirs = await listKeyDirs(storeRoot);
  if (dirs.length === 0) return null;

  const byMeta = dirs.find((d) => d.metaKid === keyId);
  if (byMeta) return byMeta.privatePemPath;

  const byDir = dirs.find((d) => path.basename(d.dir) === keyId);
  if (byDir) return byDir.privatePemPath;

  return null;
}

/** Resolve a public key path using the same strategy as private (needed by verify). */
export async function resolvePublicKeyPath(storeRoot: string, keyId: string): Promise<string | null> {
  // Try direct patterns
  const direct = [
    path.join(storeRoot, 'ed25519', keyId, 'public.pem'),
    path.join(storeRoot, keyId, 'public.pem'),
    path.join(storeRoot, 'ed25519', `${keyId}.pub.pem`),
  ];
  for (const p of direct) {
    if (fs.existsSync(p)) return p;
  }

  const dirs = await listKeyDirs(storeRoot);
  if (dirs.length === 0) return null;

  const byMeta = dirs.find((d) => d.metaKid === keyId && d.publicPemPath);
  if (byMeta?.publicPemPath) return byMeta.publicPemPath;

  const byDir = dirs.find((d) => path.basename(d.dir) === keyId && d.publicPemPath);
  if (byDir?.publicPemPath) return byDir.publicPemPath;

  return null;
}

/** Convenience: resolve both private and public paths together. */
export async function resolveKeypairPaths(
  storeRoot: string,
  keyId: string
): Promise<Readonly<{ privatePemPath: string | null; publicPemPath: string | null }>> {
  const [priv, pub] = await Promise.all([
    resolvePrivateKeyPath(storeRoot, keyId),
    resolvePublicKeyPath(storeRoot, keyId),
  ]);
  return { privatePemPath: priv, publicPemPath: pub };
}
