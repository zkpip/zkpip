// Loads JSON Schema $id values from the /schemas directory.
// This avoids hard-coding and keeps CLI in sync with AJV bootstrap.

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

type KnownSchema = "common" | "error" | "issue" | "ecosystem";

export type SchemaIds = Record<KnownSchema, string>;

function repoSchemasDirFromHere(): string {
  // Resolve repo root from the compiled file location:
  // dist/cli/schemaIds.js -> dist -> core -> packages -> <repo root>
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const repoRoot = resolve(__dirname, "../../../../");
  const candidate = resolve(repoRoot, "schemas");
  if (existsSync(candidate)) return candidate;
  // Fallback to CWD for local runs
  return resolve(process.cwd(), "schemas");
}

function readSchemaId(baseDir: string, filename: string): string {
  const abs = resolve(baseDir, filename);
  const json = JSON.parse(readFileSync(abs, "utf-8")) as unknown;
  if (json && typeof json === "object" && "$id" in json) {
    const id = (json as { $id?: unknown }).$id;
    if (typeof id === "string" && id.length > 0) return id;
  }
  // Fallback: return the filename itself if $id is missing
  return filename;
}

/** Load all known schema IDs (common, error, issue, ecosystem). */
export function loadSchemaIds(): SchemaIds {
  const base = repoSchemasDirFromHere();
  return {
    common: readSchemaId(base, "common.schema.json"),
    error: readSchemaId(base, "error.schema.json"),
    issue: readSchemaId(base, "issue.schema.json"),
    ecosystem: readSchemaId(base, "ecosystem.schema.json"),
  };
}
