// ESM-only, strict TS. No "any".
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export class CliFileError extends Error {
  public readonly code: 'FILE_NOT_FOUND' | 'NOT_A_FILE' | 'WRITE_DIR_MISSING';
  public readonly path: string;
  constructor(msg: string, code: CliFileError['code'], path: string) {
    super(msg);
    this.name = 'CliFileError';
    this.code = code;
    this.path = path;
  }
}

export function resolvePath(p: string): string {
  // Always absolute on handler usage
  return resolve(p);
}

export function assertFileExists(p: string): void {
  if (!existsSync(p)) {
    throw new CliFileError(`File not found: ${p}`, 'FILE_NOT_FOUND', p);
  }
  const st = statSync(p);
  if (!st.isFile()) {
    throw new CliFileError(`Not a file: ${p}`, 'NOT_A_FILE', p);
  }
}

export function readUtf8Checked(p: string): string {
  assertFileExists(p);
  return readFileSync(p, 'utf8');
}

export function ensureParentDir(outPath: string, createIfMissing = false): void {
  const dir = dirname(outPath);
  if (!existsSync(dir)) {
    if (createIfMissing) {
      mkdirSync(dir, { recursive: true });
    } else {
      throw new CliFileError(
        `Parent directory does not exist: ${dir}`,
        'WRITE_DIR_MISSING',
        dir,
      );
    }
  }
}
