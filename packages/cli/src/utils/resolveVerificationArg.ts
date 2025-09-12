// ESM + NodeNext; no `any`
// Resolve --verification: inline JSON OR filesystem path (absolute/relative with cwd + pkg-root fallback)

import { stat, access } from 'node:fs/promises';
import { constants as FS } from 'node:fs';
import { isAbsolute, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Json } from '../types/json.js';

function isJsonLike(s: string): boolean {
  const t = s.trimStart();
  return t.startsWith('{') || t.startsWith('[');
}

// packages/cli gyökér ( …/packages/cli )
function cliPkgRoot(): string {
  // this file: .../packages/cli/src/utils/resolveVerificationArg.ts
  const here = fileURLToPath(import.meta.url);
  const dir = dirname(here); // .../src/utils
  return resolve(dir, '..', '..'); // -> .../packages/cli
}

async function pathExistsFile(p: string): Promise<boolean> {
  try {
    await access(p, FS.F_OK);
    const s = await stat(p);
    return s.isFile();
  } catch {
    return false;
  }
}

/**
 * If raw is inline JSON → parse and return Json.
 * Otherwise resolve a filesystem path:
 *   - absolute: use as-is if file exists
 *   - relative: try cwd, then CLI package root
 * Returns: absolute path string OR parsed Json
 */
export async function resolveVerificationArg(raw: string): Promise<string | Json> {
  const input = raw.trim();

  // Optional scheme guards (currently OFF by design)
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(input)) {
    // canvector:// or other schemes are disabled for now
    throw new Error(`Unsupported URI scheme in --verification: ${input}`);
  }

  // Inline JSON?
  if (isJsonLike(input)) {
    try {
      return JSON.parse(input) as Json;
    } catch (e) {
      const msg = (e as Error)?.message ?? String(e);
      throw new Error(`JSON.parse failed for inline --verification: ${msg}`);
    }
  }

  // Filesystem path
  const candidates: string[] = [];
  if (isAbsolute(input)) {
    candidates.push(input);
  } else {
    candidates.push(resolve(process.cwd(), input));
    candidates.push(resolve(cliPkgRoot(), input));
  }

  for (const p of candidates) {
    if (await pathExistsFile(p)) return p;
  }

  throw new Error(`ENOENT: no such file or directory, open '${input}'`);
}
