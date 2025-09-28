// packages/cli/src/utils/keystore-index.ts
// Keystore reverse index utilities (keyId -> entry).
// - File: <storeRoot>/keys.index.json
// - Atomic writes via tmp + rename
// - No `any`, exactOptionalPropertyTypes-friendly

import * as fsp from 'node:fs/promises';
import * as fs from 'node:fs';
import * as path from 'node:path';

export type KeyIndexEntry = Readonly<{
  dir: string;                 // usually equals keyId (folder name under storeRoot)
  alg: 'ed25519';
  createdAt: string;           // ISO timestamp
  label?: string | undefined;  // optional human label
  spkiSha256?: string | undefined; // optional hex (handy for extra checks/search)
}>;

export type KeyIndex = Readonly<Record<string, KeyIndexEntry>>;

export const INDEX_FILENAME = 'keys.index.json' as const;

export function indexPath(storeRoot: string): string {
  return path.join(storeRoot, INDEX_FILENAME);
}

/** Best-effort JSON shape guard (very light). */
function isKeyIndex(x: unknown): x is KeyIndex {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return false;
  for (const [k, v] of Object.entries(x as Record<string, unknown>)) {
    if (typeof k !== 'string' || !v || typeof v !== 'object' || Array.isArray(v)) return false;
    const e = v as Record<string, unknown>;
    if (typeof e.dir !== 'string') return false;
    if (e.alg !== 'ed25519') return false;
    if (typeof e.createdAt !== 'string') return false;
    if ('label' in e && e.label !== undefined && typeof e.label !== 'string') return false;
    if ('spkiSha256' in e && e.spkiSha256 !== undefined && typeof e.spkiSha256 !== 'string') {
      return false;
    }
  }
  return true;
}

/** Read index if present; returns null if missing or invalid. */
export async function readKeyIndex(storeRoot: string): Promise<KeyIndex | null> {
  const p = indexPath(storeRoot);
  if (!fs.existsSync(p)) return null;
  try {
    const raw = await fsp.readFile(p, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    return isKeyIndex(parsed) ? (parsed as KeyIndex) : null;
  } catch {
    return null;
  }
}

/** Atomic write via tmp file + rename. */
async function writeKeyIndex(storeRoot: string, index: KeyIndex): Promise<void> {
  const p = indexPath(storeRoot);
  await fsp.mkdir(storeRoot, { recursive: true });
  const tmp = `${p}.tmp-${process.pid}-${Date.now()}`;
  const data = JSON.stringify(index, null, 2) + '\n';
  await fsp.writeFile(tmp, data, { encoding: 'utf8' });
  await fsp.rename(tmp, p);
}

/** Insert or update mapping keyId → entry. */
export async function upsertKeyIndex(
  storeRoot: string,
  args: Readonly<{ keyId: string } & KeyIndexEntry>
): Promise<void> {
  const current = (await readKeyIndex(storeRoot)) ?? {};
  const next: Record<string, KeyIndexEntry> = {
    ...current,
    [args.keyId]: {
      dir: args.dir,
      alg: args.alg,
      createdAt: args.createdAt,
      ...(args.label ? { label: args.label } : {}),
      ...(args.spkiSha256 ? { spkiSha256: args.spkiSha256 } : {}),
    },
  };
  await writeKeyIndex(storeRoot, next);
}

/** Write per-key meta file alongside PEMs (non-indexed, informational). */
export async function writeKeyMeta(
  keyDir: string,
  meta: Readonly<{
    kid: string;
    alg: 'ed25519';
    createdAt: string;
    label?: string | undefined;
    spkiSha256?: string | undefined;
  }>
): Promise<void> {
  await fsp.mkdir(keyDir, { recursive: true });
  const p = path.join(keyDir, 'key.meta.json');
  const data = JSON.stringify(meta, null, 2) + '\n';
  await fsp.writeFile(p, data, { encoding: 'utf8' });
}
