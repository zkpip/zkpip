// Core-local schema picker (filename → $id), no "any".
// Prefers ProofEnvelope, falls back to canonical $id if not discoverable.

import path from 'node:path';
import { readdirSync, readFileSync, statSync } from 'node:fs';

function includesAny(haystack: string, needles: ReadonlyArray<string>): boolean {
  const s = haystack.toLowerCase();
  return needles.some((n) => s.includes(n.toLowerCase()));
}

/** Collect $id strings from JSON schemas under a root dir (sync, robust). */
function collectSchemaIds(root: string): string[] {
  const ids: string[] = [];
  const stack: string[] = [root];

  while (stack.length > 0) {
    const dir = stack.pop() as string;
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    for (const name of entries) {
      const full = path.join(dir, name);
      let st: ReturnType<typeof statSync>;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (!name.endsWith('.json')) continue;

      try {
        const raw = readFileSync(full, 'utf8');
        const obj = JSON.parse(raw) as unknown;
        const id = (obj && typeof obj === 'object' && (obj as { $id?: unknown }).$id) as unknown;
        if (typeof id === 'string') ids.push(id);
      } catch {
        // ignore unreadable/invalid json
      }
    }
  }
  return ids;
}

/**
 * Pick target schema $id by filename heuristics.
 * Uses schemasRoot (if provided) to list available $id values.
 */
export function pickSchemaId(absPath: string, schemasRoot?: string): string {
  const base = path.basename(absPath).toLowerCase();
  const full = absPath.replace(/\\/g, '/').toLowerCase(); // ⬅ útvonal alapú mintákhoz
  const allIds: ReadonlyArray<string> =
    typeof schemasRoot === 'string' && schemasRoot.length > 0 ? collectSchemaIds(schemasRoot) : [];

  const findId = (needles: string[]): string | undefined =>
    allIds.find((id) => includesAny(id, needles));

  // ---- ProofEnvelope FIRST, with canonical fallback ----
  const CANON_ENV_ID = 'urn:zkpip:mvs.proofEnvelope.schema.json';
  if (/\bproof[-_ ]?envelope\b/.test(base) || /\/proof[-_]?envelope\//.test(full)) {
    const id =
      allIds.find((x) => /mvs(\.|:schemas:)?proofenvelope\.schema\.json/i.test(x)) ??
      findId(['proof-envelope', 'proof_envelope', 'proofenvelope', 'proofEnvelope']) ??
      CANON_ENV_ID;
    return id;
  }

  // ---- issue----
  if (includesAny(base, ['issue']) || /\/issue\//.test(full)) {
    const id =
      allIds.find((x) => /mvs(\.|:schemas:)?issue\.schema\.json/i.test(x)) ??
      findId(['issue']) ??
      'urn:zkpip:mvs.issue.schema.json';
    return id;
  }

  // ---- ecosystem----
  if (includesAny(base, ['ecosystem']) || /\/ecosystem\//.test(full)) {
    const id =
      allIds.find((x) => /mvs(\.|:schemas:)?ecosystem\.schema\.json/i.test(x)) ??
      findId(['ecosystem']) ??
      'urn:zkpip:mvs.ecosystem.schema.json';
    return id;
  }

  // verification (legacy: groth16/evm or folder)
  if (includesAny(base, ['groth16', 'evm']) || /\/verification\//.test(full)) {
    const id =
      findId(['verification', 'groth16', 'evm']) ?? 'urn:zkpip:mvs.verification.schema.json';
    return id;
  }

  // public inputs/signals
  if (includesAny(base, ['publicsignals', 'public-signals', 'public'])) {
    const id = findId(['publicsignals', 'public-signals', 'public']);
    if (id) return id;
  }

  // CIR / circuit specs
  if (includesAny(base, ['cir', 'circuit', 'witness']) || /\/cir(cuit)?\//.test(full)) {
    const id = findId(['cir', 'circuit', 'witness']) ?? 'urn:zkpip:mvs.cir.schema.json';
    return id;
  }

  const CANON_CORE_ID = 'urn:zkpip:mvs.core.schema.json';
  return CANON_CORE_ID;
}
