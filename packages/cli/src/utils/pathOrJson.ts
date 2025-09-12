import fs from 'node:fs';
import path from 'node:path';
import type { Json } from '../types/json.js';

function looksLikeJsonText(s: string): boolean {
  const t = s.trim();
  return (t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'));
}

/**
 * Resolve a CLI argument that can be:
 * - raw JSON (object/array as string), or
 * - a file path (relative or absolute) to JSON contents.
 *
 * Throws ENOENT/EACCES/JSON.parse on error (caught by caller → io_error/2).
 */
export function readJsonArgSync(arg: string): Json {
  const t = (arg ?? '').trim();
  if (!t) {
    throw new Error('Empty verification argument.');
  }
  if (looksLikeJsonText(t)) {
    return JSON.parse(t) as Json;
  }
  const abs = path.isAbsolute(t) ? t : path.join(process.cwd(), t);
  const data = fs.readFileSync(abs, 'utf8'); // may throw ENOENT/EACCES
  return JSON.parse(data) as Json; // may throw JSON.parse error
}
