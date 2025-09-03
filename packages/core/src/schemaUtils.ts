/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { readFile } from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Public API
 * Loads a JSON schema from one of the supported sources:
 *  - URN:  "urn:zkpip:mvs.proof-bundle.schema.json"
 *  - HTTP: "http(s)://…"
 *  - FILE: "file://…"
 *  - Relative FS path (resolved against schemasRoot with alias fallback, then CWD)
 *
 * No global state, no logging. Deterministic, descriptive errors.
 */
export async function loadSchemaJson(
  source: string | URL,
  opts?: { schemasRoot?: string }
): Promise<unknown> {
  const srcStr = source instanceof URL ? source.toString() : String(source);
  const schemasRoot = opts?.schemasRoot ? path.resolve(opts.schemasRoot) : undefined;

  // 1) HTTP(S)
  if (isHttpUrlString(srcStr)) {
    const res = await fetch(srcStr);
    if (!res.ok) {
      throw new Error(
        `E_SCHEMA_LOAD_HTTP_${res.status}: GET ${srcStr} → ${res.status} ${res.statusText}`
      );
    }
    try {
      return await res.json();
    } catch (err: any) {
      throw new Error(
        `E_SCHEMA_LOAD_INVALID_JSON: Failed to parse HTTP JSON from ${srcStr}: ${err?.message ?? String(
          err
        )}`
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

    // alias fallback: <schemasRoot>/<dir>.<file>
    const alias = aliasPathForCanonical(canonAbs, schemasRoot);
    if (alias) candidates.push(alias);

    const { value, attempted } = await tryReadCandidates(candidates);
    if (value !== undefined) return value;

    throw new Error(
      makeNotFoundMessage(srcStr, attempted)
    );
  }

  // 4) Relative / absolute FS path resolution
  const attempted: string[] = [];
  const candidates: string[] = [];

  if (path.isAbsolute(srcStr)) {
    candidates.push(srcStr);
  } else {
    // 4.1 schemasRoot/<rel>
    if (schemasRoot) {
      candidates.push(path.resolve(schemasRoot, srcStr));

      // 4.2 alias under schemasRoot: <schemasRoot>/<dir>.<file>
      const alias = aliasPathForRelative(srcStr, schemasRoot);
      if (alias) candidates.push(alias);
    }

    // 4.3 CWD/<rel>
    candidates.push(path.resolve(process.cwd(), srcStr));
  }

  const res = await tryReadCandidates(candidates);
  if (res.value !== undefined) return res.value;

  throw new Error(makeNotFoundMessage(srcStr, res.attempted));
}

/**
 * INTERNAL (not exported)
 * Map a zkpip URN to a filesystem path under schemasRoot, using the canonical form:
 *   urn:zkpip:mvs.proof-bundle.schema.json → <schemasRoot>/mvs/proof-bundle.schema.json
 * Returns null if the URN namespace is not supported or the alias is malformed.
 */
function resolveUrnToSchemaPath(urn: string, schemasRoot?: string): string | null {
  const prefix = "urn:zkpip:";
  if (!urn.startsWith(prefix)) return null;

  const alias = urn.slice(prefix.length); // e.g. "mvs.proof-bundle.schema.json"
  const firstDot = alias.indexOf(".");
  if (firstDot < 0) return null;

  const dir = alias.slice(0, firstDot); // "mvs"
  const file = alias.slice(firstDot + 1); // "proof-bundle.schema.json"
  const joined = path.join(schemasRoot ?? "", dir, file);
  return joined;
}

/* -------------------------- helpers (internal) --------------------------- */

function isHttpUrlString(s: string): boolean {
  return s.startsWith("http://") || s.startsWith("https://");
}

function isFileUrlString(s: string): boolean {
  return s.startsWith("file://");
}

function isUrnString(s: string): boolean {
  return s.startsWith("urn:");
}

/**
 * Try to read a list of candidate absolute file paths in order; return the first that succeeds.
 * Collects attempted paths for deterministic error reporting.
 */
async function tryReadCandidates(candidates: string[]): Promise<{ value: unknown | undefined; attempted: string[] }> {
  const attempted: string[] = [];
  for (const p of candidates) {
    attempted.push(p);
    try {
      const v = await readJsonFromFile(p);
      return { value: v, attempted };
    } catch (err: any) {
      // Continue only on "not found" or "is a directory"; rethrow other IO errors
      if (!isNotFoundErr(err) && !isIsDirectoryErr(err)) {
        throw err;
      }
    }
  }
  return { value: undefined, attempted };
}

/**
 * Read and parse JSON from an absolute filesystem path.
 * Strips an initial BOM if present for robustness.
 */
async function readJsonFromFile(absPath: string, displayLabel?: string): Promise<unknown> {
  try {
    const raw = await readFile(absPath, "utf8");
    const text = raw.replace(/^\uFEFF/, "");
    return JSON.parse(text);
  } catch (err: any) {
    if (isNotFoundErr(err) || isIsDirectoryErr(err)) {
      throw err; // bubble up for candidate iteration
    }
    // Any other error is considered a parse problem from this source
    const label = displayLabel ?? absPath;
    throw new Error(
      `E_SCHEMA_LOAD_INVALID_JSON: Failed to parse JSON from ${label}: ${err?.message ?? String(err)}`
    );
  }
}

/**
 * Build alias path for a canonical "<schemasRoot>/<dir>/<file>".
 * Result: "<schemasRoot>/<dir>.<file>" (flattened into the root).
 */
function aliasPathForCanonical(canonicalAbs: string, schemasRoot?: string): string | null {
  if (!schemasRoot) return null;

  const rel = path.relative(schemasRoot, canonicalAbs);
  if (rel.startsWith("..")) return null; // outside root; do not alias

  const dir = path.dirname(rel);
  const base = path.basename(rel);
  if (!dir || dir === "." ) return null;

  const flatName = `${dir.replace(/[\\/]/g, ".")}.${base}`;
  return path.resolve(schemasRoot, flatName);
}

/**
 * Build alias path for a *relative* input under schemasRoot:
 *   "<schemasRoot>/<dir>.<file>"
 */
function aliasPathForRelative(relInput: string, schemasRoot: string): string | null {
  const dir = path.dirname(relInput);
  const base = path.basename(relInput);
  if (!dir || dir === ".") return null;

  const flatName = `${dir.replace(/[\\/]/g, ".")}.${base}`;
  return path.resolve(schemasRoot, flatName);
}

function isNotFoundErr(err: any): boolean {
  return err && typeof err === "object" && (err.code === "ENOENT" || err.code === "ENAMETOOLONG");
}

function isIsDirectoryErr(err: any): boolean {
  // EISDIR can occur if a directory is addressed as a file
  return err && typeof err === "object" && err.code === "EISDIR";
}

/**
 * Build a deterministic not-found error message.
 * Lists all attempted file paths, so that debugging is reproducible.
 */
function makeNotFoundMessage(source: string, attempted: string[]): string {
  const list = attempted.map((p) => ` - ${p}`).join("\n");
  return `E_SCHEMA_LOAD_NOT_FOUND: Unable to resolve schema from "${source}". Tried:\n${list}`;
}