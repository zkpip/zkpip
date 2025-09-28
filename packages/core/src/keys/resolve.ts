// Resolve a key by keyId prefix scanning a directory of .pub SPKI files.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { keyIdFromSpki } from './keyId.js';

export type ResolvedKey = Readonly<{
  keyId: string;
  file: string;
  spki: Uint8Array;
}>;

/** Finds first .pub whose derived keyId starts with 'wanted'. */
export async function resolveKeyById(keyDir: string, wanted: string): Promise<ResolvedKey | null> {
  const files = await fs.promises.readdir(keyDir);
  for (const f of files) {
    if (!f.endsWith('.pub')) continue;
    const p = path.join(keyDir, f);
    const raw = await fs.promises.readFile(p);
    const kid = keyIdFromSpki(new Uint8Array(raw));
    if (kid.startsWith(wanted)) {
      return { keyId: kid, file: p, spki: new Uint8Array(raw) };
    }
  }
  return null;
}
