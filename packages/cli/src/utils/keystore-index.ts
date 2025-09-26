import * as fsp from 'node:fs/promises';
import * as fs from 'node:fs';
import path from 'node:path';

export type KeyIndexEntry = Readonly<{
  dir: string;
  alg: 'ed25519';
  createdAt: string;
  label?: string;
}>;

export type KeyIndex = Readonly<Record<string, KeyIndexEntry>>;

function indexPath(storeRoot: string): string {
  return path.join(storeRoot, 'keys.index.json');
}

export async function readKeyIndex(storeRoot: string): Promise<KeyIndex | null> {
  const p = indexPath(storeRoot);
  if (!fs.existsSync(p)) return null;
  try {
    const raw = await fsp.readFile(p, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as KeyIndex;
    }
    return null;
  } catch {
    return null;
  }
}

// Atomic write via tmp file + rename
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
    },
  };
  await writeKeyIndex(storeRoot, next);
}

/** Write per-key meta file alongside PEMs. */
export async function writeKeyMeta(
  keyDir: string,
  meta: Readonly<{ kid: string; alg: 'ed25519'; createdAt: string; label?: string }>
): Promise<void> {
  await fsp.mkdir(keyDir, { recursive: true });
  const p = path.join(keyDir, 'key.meta.json');
  const data = JSON.stringify(meta, null, 2) + '\n';
  await fsp.writeFile(p, data, { encoding: 'utf8' });
}
