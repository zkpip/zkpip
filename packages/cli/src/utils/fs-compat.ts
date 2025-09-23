/* eslint-disable import/no-duplicates */
// ESM, strict TS, no "any".

import { dirname } from 'node:path';
import { existsSync, mkdirSync as _mkdirSync, writeFileSync as _writeFileSync, type WriteFileOptions } from 'node:fs';
import { writeFile as _writeFile, mkdir as _mkdir } from 'node:fs/promises';
import { logFs } from './debug-fs.js';
import type { MakeDirectoryOptions } from 'node:fs';
import { ensureDirExists } from './paths.js';

// Overloads make TS pick the right fs/promises signature
export async function mkdir(path: string, options?: MakeDirectoryOptions): Promise<void>;
export async function mkdir(path: string, options: number): Promise<void>;
export async function mkdir(
  path: string,
  options?: number | MakeDirectoryOptions,
): Promise<void> {
  if (typeof options === 'number' || options === undefined) {
    // numeric mode or undefined → pass through
    await _mkdir(path, options);
  } else {
    // object options → ensure recursive by default
    const opts: MakeDirectoryOptions = { recursive: true, ...options };
    await _mkdir(path, opts);
  }
  logFs('mkdir', path);
}

function ensureParentDir(filePath: string): void {
  const parent = dirname(filePath);
  if (!existsSync(parent)) ensureDirExists(parent);
}

export function mkdirSync(path: string, options?: Parameters<typeof _mkdirSync>[1]): string | undefined {
  if (!existsSync(path)) {
    _mkdirSync(path, { recursive: true, ...(typeof options === 'object' ? options : {}) });
    logFs('mkdirSync', path);
  }
  return undefined;
}

export function writeFileSync(file: string, data: string | Uint8Array, options?: WriteFileOptions): void {
  ensureParentDir(file);
  _writeFileSync(file, data, options);
  logFs('writeFileSync', file, { bytes: typeof data === 'string' ? Buffer.byteLength(data) : data.byteLength });
}

export async function writeFile(file: string, data: string | Uint8Array, options?: WriteFileOptions): Promise<void> {
  ensureParentDir(file);
  await _writeFile(file, data, options);
  logFs('writeFile', file, { bytes: typeof data === 'string' ? Buffer.byteLength(data) : data.byteLength });
}

// Overloads: (file, value) and (file, value, pretty:boolean|number)
export function writeJson(file: string, value: unknown): void;
export function writeJson(file: string, value: unknown, pretty: boolean | number): void;
export function writeJson(file: string, value: unknown, pretty?: boolean | number): void {
  const spaces = typeof pretty === 'number' ? pretty : pretty ? 2 : 0;
  const text = JSON.stringify(value, null, spaces);
  writeFileSync(file, text, { encoding: 'utf8' });
  logFs('writeJson', file, { pretty: spaces });
}

export type { WriteFileOptions } from 'node:fs';
