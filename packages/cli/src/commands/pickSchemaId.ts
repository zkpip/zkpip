// Heuristic schema $id picker using the input file name/path.
// Backed by actual $id values loaded from the /schemas directory.

import { basename } from 'path';
import { loadSchemaIds } from './schemaIds.js';

const ids = loadSchemaIds();

/**
 * Pick a schema $id based on the input file name/path (case-insensitive).
 *
 * Priority (substring match):
 *   1) Proof-bundle manifest → "proof-set" | "bundle" | "manifest" → proofSet
 *   2) Canonical IR          → "cir" | "circuit" | "circuits"         → cir
 *   3) Verification          → "verification" | "verify" | "error"    → verification
 *   4) Issue                 → "issue"                                 → issue
 *   5) Ecosystem             → "ecosystem" | "eco"                     → ecosystem
 *   6) Default                                                   → core
 *
 * Notes:
 * - The "error" legacy naming maps to "verification" for backward compatibility.
 * - The "manifest" keyword is routed to proofSet (typical file naming).
 * - If you need stricter routing, replace/augment these heuristics with a config.
 */
export function pickSchemaId(filePath: string): string {
  const name = basename(filePath).toLowerCase();

  // 1) Proof-bundle manifest
  if (name.includes('proof-set') || name.includes('bundle') || name.includes('manifest')) {
    return ids.proofSet;
  }

  // 2) CIR (Canonical Intermediate Representation)
  if (name.includes('cir') || name.includes('circuit')) {
    return ids.cir;
  }

  // 3) Verification (legacy: "error")
  if (name.includes('verification') || name.includes('verify') || name.includes('error')) {
    return ids.verification;
  }

  // 4) Issue
  if (name.includes('issue')) {
    return ids.issue;
  }

  // 5) Ecosystem
  if (name.includes('ecosystem') || name.includes('eco')) {
    return ids.ecosystem;
  }

  // 6) Default → core
  return ids.core;
}
