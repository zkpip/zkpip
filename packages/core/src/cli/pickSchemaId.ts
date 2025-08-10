// Heuristic schema id picker using filenames, backed by actual $id values.

import { basename } from "path";
import { loadSchemaIds } from "./schemaIds.js";

const ids = loadSchemaIds();

/**
 * Pick a schema id based on the input file name/path.
 * Priority:
 *   - name contains "error"     -> error schema
 *   - name contains "issue"     -> issue schema
 *   - name contains "ecosystem" or "eco" -> ecosystem schema
 *   - otherwise                 -> common schema
 */
export function pickSchemaId(filePath: string): string {
  const name = basename(filePath).toLowerCase();

  if (name.includes("error")) return ids.error;
  if (name.includes("issue")) return ids.issue;
  if (name.includes("ecosystem") || name.includes("eco")) return ids.ecosystem;

  return ids.common;
}
