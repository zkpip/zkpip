// packages/cli/src/utils/keystore-lookup.ts
import * as fs from 'node:fs';
import * as path from 'node:path';

export function locatePublicByKeyId(storeRoot: string, keyId: string):
  | { dir: string; publicPemPath: string }
  | null
{
  const idx = readKeyIndexSyncSafe(storeRoot);
  if (idx && idx[keyId]?.dir) {
    const dir = path.join(storeRoot, idx[keyId]!.dir);
    const pub = path.join(dir, 'public.pem');
    if (fs.existsSync(pub)) return { dir, publicPemPath: pub };
  }
  const cands = [
    path.join(storeRoot, keyId, 'public.pem'),
    path.join(storeRoot, 'ed25519', keyId, 'public.pem'),
    path.join(storeRoot, `${keyId}.pub.pem`),
    path.join(storeRoot, 'ed25519', `${keyId}.pub.pem`),
    path.join(storeRoot, 'public.pem'),
  ];
  for (const p of cands) if (fs.existsSync(p)) return { dir: path.dirname(p), publicPemPath: p };
  if (fs.existsSync(storeRoot)) {
    for (const e of fs.readdirSync(storeRoot, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      const p = path.join(storeRoot, e.name, 'public.pem');
      if (fs.existsSync(p)) return { dir: path.dirname(p), publicPemPath: p };
    }
  }
  return null;
}

export function locatePrivateByKeyId(storeRoot: string, keyId: string):
  | { dir: string; privatePemPath: string }
  | null
{
  const idx = readKeyIndexSyncSafe(storeRoot);
  if (idx && idx[keyId]?.dir) {
    const dir = path.join(storeRoot, idx[keyId]!.dir);
    const priv = path.join(dir, 'private.pem');
    if (fs.existsSync(priv)) return { dir, privatePemPath: priv };
  }
  const cands = [
    path.join(storeRoot, keyId, 'private.pem'),
    path.join(storeRoot, 'ed25519', keyId, 'private.pem'),
    path.join(storeRoot, 'private.pem'),
  ];
  for (const p of cands) if (fs.existsSync(p)) return { dir: path.dirname(p), privatePemPath: p };
  return null;
}

function readKeyIndexSyncSafe(storeRoot: string):
  | (Record<string, { dir: string }>)
  | null
{
  try {
    const p = path.join(storeRoot, 'keys.index.json');
    if (!fs.existsSync(p)) return null;
    const raw = fs.readFileSync(p, 'utf8');
    const json = JSON.parse(raw) as unknown;
    if (json && typeof json === 'object' && !Array.isArray(json)) return json as Record<string, { dir: string }>;
  } catch { /* just placeholder */}
  return null;
}
