// packages/core/src/utils/fs-compat.ts
import { promises as fsp } from 'node:fs';
import * as fs from 'node:fs';
import { dirname } from 'node:path';

// Accept both WriteFileOptions objects and string encodings (e.g., 'utf8')
type WriteOpts = fs.WriteFileOptions | BufferEncoding;

export async function mkdir(
  p: string,
  opts: { recursive?: boolean } = { recursive: true }
) {
  return fsp.mkdir(p, opts);
}

export async function writeFile(
  p: string,
  data: string | Buffer,
  options?: WriteOpts
) {
  await mkdir(dirname(p), { recursive: true });
  return fsp.writeFile(p, data, options);
}

export function writeFileSync(
  p: string,
  data: string | Buffer,
  options?: WriteOpts
) {
  fs.mkdirSync(dirname(p), { recursive: true });
  fs.writeFileSync(p, data, options);
}
