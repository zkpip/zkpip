// Loads JSON Schema $id values from the /schemas directory.
// This avoids hard-coding and keeps the CLI in sync with the repo's schemas.

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

/**
 * Preferred schema keys (MVS naming):
 * - core         → mvs.core.schema.json            (fallback: common.schema.json)
 * - verification → mvs.verification.schema.json    (fallback: error.schema.json)
 * - issue        → mvs.issue.schema.json
 * - ecosystem    → mvs.ecosystem.schema.json
 * - proofBundle  → mvs.proof-bundle.schema.json
 * - cir          → mvs.cir.schema.json
 *
 * If you still need legacy aliases for compatibility, you can add them
 * where indicated below. Otherwise, prefer using the MVS keys everywhere.
 */
type PreferredSchema = 'core' | 'verification' | 'issue' | 'ecosystem' | 'proofBundle' | 'cir';

/** Final return type: preferred keys only. */
export type SchemaIds = Record<PreferredSchema, string>;

/** Resolve the /schemas directory from the compiled file location. */
function repoSchemasDirFromHere(): string {
  // Compiled file layout (ESM):
  // dist/cli/schemaIds.js -> dist -> core -> packages -> <repo root>
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const repoRoot = resolve(__dirname, '../../../../');
  const candidate = resolve(repoRoot, 'schemas');
  if (existsSync(candidate)) return candidate;
  // Fallback to CWD for local runs (useful for dev & tests)
  return resolve(process.cwd(), 'schemas');
}

/** Read the $id from a single schema file; returns null if missing/not found. */
function readSchemaId(baseDir: string, filename: string): string | null {
  const abs = resolve(baseDir, filename);
  if (!existsSync(abs)) return null;
  const json = JSON.parse(readFileSync(abs, 'utf-8')) as unknown;
  if (json && typeof json === 'object' && '$id' in json) {
    const id = (json as { $id?: unknown }).$id;
    if (typeof id === 'string' && id.length > 0) return id;
  }
  // No $id or invalid file → return null to try next candidate
  return null;
}

/** From a list of candidate filenames, return the first existing file's $id. */
function readFirstExisting(baseDir: string, candidates: string[]): string {
  for (const fn of candidates) {
    const id = readSchemaId(baseDir, fn);
    if (id) return id;
  }
  // If none exists or no $id found, return the first candidate name as a marker.
  // This helps downstream error messages point to the expected filename.
  return candidates[0];
}

/** Load all known schema $id values (MVS set). */
export function loadSchemaIds(): SchemaIds {
  const base = repoSchemasDirFromHere();

  const core = readFirstExisting(base, ['mvs.core.schema.json', 'common.schema.json']);

  const verification = readFirstExisting(base, [
    'mvs.verification.schema.json',
    'error.schema.json',
  ]);

  const issue = readFirstExisting(base, ['mvs.issue.schema.json', 'issue.schema.json']);

  const ecosystem = readFirstExisting(base, ['mvs.ecosystem.schema.json', 'ecosystem.schema.json']);

  const proofBundle = readFirstExisting(base, ['mvs.proof-bundle.schema.json']);

  const cir = readFirstExisting(base, ['mvs.cir.schema.json']);

  // Preferred keys only. If you still need legacy aliases (common/error),
  // create them in the caller or extend the return type here.
  return {
    core,
    verification,
    issue,
    ecosystem,
    proofBundle,
    cir,
  };
}
