/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { readFile } from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

function defaultSchemasRoot(): string {
  // A dist fájl helye → ../schemas
  const here = fileURLToPath(new URL('.', import.meta.url));
  return path.resolve(here, '../schemas');
}

export type LoadSchemaOptions = {
  schemasRoot?: string;
};

/**
 * Public API
 * JSON schema loading:
 *  - URN:  "urn:zkpip:mvs.proof-envelope.schema.json"
 *  - HTTP: "http(s)://…"
 *  - FILE: "file://…"
 */
export async function loadSchemaJson(
  source: string | URL,
  opts?: LoadSchemaOptions,
): Promise<unknown> {
  const srcStr = source instanceof URL ? source.toString() : String(source);
  const schemasRoot = opts?.schemasRoot ? path.resolve(opts.schemasRoot) : defaultSchemasRoot();

  // 1) HTTP(S)
  if (isHttpUrlString(srcStr)) {
    const res = await fetch(srcStr);
    if (!res.ok) {
      throw new Error(
        `E_SCHEMA_LOAD_HTTP_${res.status}: GET ${srcStr} → ${res.status} ${res.statusText}`,
      );
    }
    try {
      return await res.json();
    } catch (err: unknown) {
      throw new Error(
        `E_SCHEMA_LOAD_INVALID_JSON: Failed to parse HTTP JSON from ${srcStr}: ${errMsg(err)}`,
      );
    }
  }

  // 2) file:// URL
  if (isFileUrlString(srcStr)) {
    const fsPath = fileURLToPath(srcStr);
    return readJsonFromFile(fsPath, `file://${fsPath}`);
  }

  // 3) URN (zkpip)
  if (isUrnString(srcStr)) {
    const canonical = resolveUrnToSchemaPath(srcStr, schemasRoot);
    if (!canonical) {
      throw new Error(`E_SCHEMA_LOAD_UNSUPPORTED_URN: ${srcStr}`);
    }
    const candidates: string[] = [];

    const canonAbs = schemasRoot ? path.resolve(canonical) : canonical;
    candidates.push(canonAbs);

    // Alias fallback: <schemasRoot>/<dir>.<file>
    const alias = aliasPathForCanonical(canonAbs, schemasRoot);
    if (alias) candidates.push(alias);

    const { value, attempted } = await tryReadCandidates(candidates);
    if (value !== undefined) return value;

    throw new Error(makeNotFoundMessage(srcStr, attempted, schemasRoot));
  }

  const candidates: string[] = [];

  if (path.isAbsolute(srcStr)) {
    candidates.push(srcStr);
  } else {
    if (schemasRoot) {
      candidates.push(path.resolve(schemasRoot, srcStr));

      const alias = aliasPathForRelative(srcStr, schemasRoot);
      if (alias) candidates.push(alias);
    }

    // 4.3 CWD/<rel> (last attempt)
    candidates.push(path.resolve(process.cwd(), srcStr));
  }

  const res = await tryReadCandidates(candidates);
  if (res.value !== undefined) return res.value;

  throw new Error(makeNotFoundMessage(srcStr, res.attempted, schemasRoot));
}

/* -------------------------- helpers (internal) --------------------------- */

/**
 * URN
 *   urn:zkpip:mvs.proof-envelope.schema.json → <schemasRoot>/mvs/proof-envelope.schema.json
 */
function resolveUrnToSchemaPath(urn: string, schemasRoot?: string): string | null {
  const prefix = 'urn:zkpip:';
  if (!urn.startsWith(prefix)) return null;

  const alias = urn.slice(prefix.length); // "mvs.proof-envelope.schema.json"
  const firstDot = alias.indexOf('.');
  if (firstDot < 0) return null;

  const dir = alias.slice(0, firstDot); // "mvs"
  const file = alias.slice(firstDot + 1); // "proof-envelope.schema.json"
  const joined = path.join(schemasRoot ?? '', dir, file);
  return joined;
}

function isHttpUrlString(s: string): boolean {
  return s.startsWith('http://') || s.startsWith('https://');
}

function isFileUrlString(s: string): boolean {
  return s.startsWith('file://');
}

function isUrnString(s: string): boolean {
  return s.startsWith('urn:');
}

async function tryReadCandidates(
  candidates: string[],
): Promise<{ value: unknown | undefined; attempted: string[] }> {
  const attempted: string[] = [];
  for (const p of candidates) {
    attempted.push(p);
    try {
      const v = await readJsonFromFile(p);
      return { value: v, attempted };
    } catch (err: unknown) {
      if (!isNotFoundErr(err) && !isIsDirectoryErr(err)) {
        throw err;
      }
    }
  }
  return { value: undefined, attempted };
}

/**
 * JSON read + parse
 * BOM remove
 */
async function readJsonFromFile(absPath: string, displayLabel?: string): Promise<unknown> {
  try {
    const raw = await readFile(absPath, 'utf8');
    const text = raw.replace(/^\uFEFF/, '');
    return JSON.parse(text);
  } catch (err: unknown) {
    if (isNotFoundErr(err) || isIsDirectoryErr(err)) {
      throw err;
    }
    const label = displayLabel ?? absPath;
    throw new Error(
      `E_SCHEMA_LOAD_INVALID_JSON: Failed to parse JSON from ${label}: ${errMsg(err)}`,
    );
  }
}

/**
 * Result: "<schemasRoot>/<dir>.<file>" (flatten).
 */
function aliasPathForCanonical(canonicalAbs: string, schemasRoot?: string): string | null {
  if (!schemasRoot) return null;

  const rel = path.relative(schemasRoot, canonicalAbs);
  if (rel.startsWith('..')) return null;

  const dir = path.dirname(rel);
  const base = path.basename(rel);
  if (!dir || dir === '.') return null;

  const flatName = `${dir.replace(/[\\/]/g, '.')}.${base}`;
  return path.resolve(schemasRoot, flatName);
}

/**
 *   "<schemasRoot>/<dir>.<file>"
 */
function aliasPathForRelative(relInput: string, schemasRoot: string): string | null {
  const dir = path.dirname(relInput);
  const base = path.basename(relInput);
  if (!dir || dir === '.') return null;

  const flatName = `${dir.replace(/[\\/]/g, '.')}.${base}`;
  return path.resolve(schemasRoot, flatName);
}

function isNotFoundErr(err: unknown): boolean {
  const code = errorCode(err);
  return code === 'ENOENT' || code === 'ENAMETOOLONG';
}

function isIsDirectoryErr(err: unknown): boolean {
  const code = errorCode(err);
  return code === 'EISDIR';
}

function makeNotFoundMessage(source: string, attempted: string[], schemasRoot?: string): string {
  const list = attempted.map((p) => ` - ${p}`).join('\n');
  const rootInfo = `schemasRoot=${schemasRoot ?? '(undefined)'}`;
  return `E_SCHEMA_LOAD_NOT_FOUND: Unable to resolve schema from "${source}" (${rootInfo}). Tried:\n${list}`;
}

// ---- error helpers --------------------------------------------------------
function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function hasCode(e: unknown): e is { code: unknown } {
  return typeof e === 'object' && e !== null && 'code' in e;
}

function errorCode(e: unknown): string | undefined {
  if (!hasCode(e)) return undefined;
  return typeof e.code === 'string' ? e.code : undefined;
}
