// packages/core/src/schemaUtils.ts
/**
 * Small, dependency-free JSON loader utility for schemas.
 * - Supports ZKPIP URNs (e.g. "urn:zkpip:mvs.proof-bundle.schema.json")
 * - Supports http(s) URLs via global fetch (Node 20+)
 * - Supports filesystem paths (absolute or relative), and file:// URLs
 *
 * ESM-only. No logging. Deterministic error messages.
 */

import { readFile } from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Load JSON from a ZKPIP URN, HTTP(S) URL, file URL, or filesystem path.
 *
 * @param source - URN string, URL (http/https/file), or filesystem path (absolute or relative).
 * @param opts   - Optional overrides (e.g., schemasRoot).
 * @returns Parsed JSON value.
 *
 * @throws If the URN format is unsupported, fetch fails, file is missing, or JSON is invalid.
 */
export async function loadSchemaJson(
  source: string | URL,
  opts?: { schemasRoot?: string }
): Promise<unknown> {
  const s = normalizeSourceToString(source);

  // ZKPIP URN
  if (isZkpipUrn(s)) {
    const root = absolutePath(opts?.schemasRoot ?? defaultSchemasRoot());

    const { dir, file } = parseZkpipUrn(s);
    const primary = path.resolve(root, dir, file);          // <root>/<dir>/<file>
    const fallback = path.resolve(root, `${dir}.${file}`);  // <root>/<dir>.<file>

    return readJsonFileFromCandidates([primary, fallback], s);
  }

  // HTTP(S)
  if (isHttpUrl(s)) {
    const res = await fetch(s);
    if (!res.ok) {
      throw new Error(
        `loadSchemaJson: HTTP ${res.status} ${res.statusText} for URL: ${s}`
      );
    }
    try {
      return await res.json();
    } catch (e) {
      throw new Error(
        `loadSchemaJson: Invalid JSON from URL: ${s} — ${(e as Error).message}`
      );
    }
  }

  // file:// URL
  if (isFileUrl(s)) {
    const absPath = fileURLToPathSafe(s);
    return readJsonFile(absPath);
  }

  // Filesystem path
  if (path.isAbsolute(s)) {
    return readJsonFile(s);
  } else {
    // Relative path: prefer schemasRoot (or default <core>/schemas).
    const root = absolutePath(opts?.schemasRoot ?? defaultSchemasRoot());

    const candidates: string[] = [];
    // 1) <root>/<rel>
    candidates.push(path.resolve(root, s));

    // 2) alias: "<dir>/<file>"  ->  "<dir>.<file>"
    const slashAlias = toFlatAlias(s);
    if (slashAlias) {
      candidates.push(path.resolve(root, slashAlias));
    }

    // 3) final fallback: CWD/<rel>
    candidates.push(path.resolve(process.cwd(), s));

    return readJsonFileFromCandidates(candidates, s);
  }
}

/* ----------------------------- Internals ----------------------------- */

/**
 * Parse ZKPIP URN of the form:
 *   urn:zkpip:<dir>.<filename>
 * Returns { dir, file }.
 */
function parseZkpipUrn(urn: string): { dir: string; file: string } {
  const m = /^urn:zkpip:([a-z0-9-]+)\.(.+)$/i.exec(urn);
  if (!m) {
    throw new Error(
      `resolveUrnToSchemaPath: Unsupported URN format: "${urn}" (expected "urn:zkpip:<dir>.<filename>")`
    );
  }
  return { dir: m[1], file: m[2] };
}

/**
 * Legacy alias conversion:
 *   "<dir>/<file>"  ->  "<dir>.<file>"
 * Returns null if it doesn't match the pattern.
 */
function toFlatAlias(relPath: string): string | null {
  const m = /^([a-z0-9-]+)\/(.+)$/i.exec(relPath);
  if (!m) return null;
  return `${m[1]}.${m[2]}`;
}

function normalizeSourceToString(source: string | URL): string {
  return typeof source === "string" ? source : source.toString();
}

function isHttpUrl(s: string): boolean {
  return /^https?:\/\//i.test(s);
}

function isFileUrl(s: string): boolean {
  return /^file:\/\//i.test(s);
}

function isZkpipUrn(s: string): boolean {
  return /^urn:zkpip:/i.test(s);
}

function fileURLToPathSafe(fileUrl: string): string {
  try {
    return fileURLToPath(fileUrl);
  } catch (e) {
    throw new Error(
      `loadSchemaJson: Invalid file URL: ${fileUrl} — ${(e as Error).message}`
    );
  }
}

async function readJsonFile(absPath: string): Promise<unknown> {
  try {
    const raw = await readFile(absPath, "utf8");
    try {
      return JSON.parse(raw) as unknown;
    } catch (e) {
      throw new Error(
        `loadSchemaJson: Invalid JSON in file: ${absPath} — ${(e as Error).message}`
      );
    }
  } catch (e: any) {
    if (e?.code === "ENOENT") {
      throw new Error(`loadSchemaJson: File not found at: ${absPath}`);
    }
    throw new Error(
      `loadSchemaJson: Failed to read file: ${absPath} — ${(e as Error).message}`
    );
  }
}

/**
 * Try to read JSON from the first existing path among candidates.
 * On ENOENT, tries the next; on other errors, fails fast.
 * If none exists, throw a deterministic error listing attempted paths.
 */
async function readJsonFileFromCandidates(
  candidates: string[],
  original: string
): Promise<unknown> {
  const errors: string[] = [];
  for (const p of candidates) {
    try {
      return await readJsonFile(p);
    } catch (e: any) {
      if (e?.message?.startsWith("loadSchemaJson: File not found at:")) {
        errors.push(p);
        continue; // try next candidate
      }
      throw e; // different error: bubble up
    }
  }
  throw new Error(
    `loadSchemaJson: File not found for "${original}". Tried: ${errors.join(" | ")}`
  );
}

/**
 * Compute the default absolute path to "<core>/schemas", relative to this file's compiled location.
 * At runtime this module lives in "<core>/dist", so "<core>/schemas" is "../schemas".
 */
function defaultSchemasRoot(): string {
  const thisFile = fileURLToPath(import.meta.url); // .../packages/core/dist/schemaUtils.js
  const distDir = path.dirname(thisFile);
  return path.resolve(distDir, "..", "schemas");
}

function absolutePath(p: string): string {
  return path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
}
