// packages/cli/src/commands/pickSchemaId.ts
import path from 'node:path';
import { readdirSync, readFileSync, statSync } from 'node:fs';

/** Collect all $id strings from JSON schemas under a root dir (sync, no any). */
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
        if (obj && typeof obj === 'object' && typeof (obj as { $id?: unknown }).$id === 'string') {
          ids.push((obj as { $id: string }).$id);
        }
      } catch {
        // ignore unreadable/invalid json
      }
    }
  }
  return ids;
}

function includesAny(haystack: string, needles: ReadonlyArray<string>): boolean {
  const s = haystack.toLowerCase();
  return needles.some((n) => s.includes(n.toLowerCase()));
}

/**
 * Pick target schema $id by filename heuristics.
 * Uses schemasRoot (if provided) to list available $id values.
 */
export function pickSchemaId(absPath: string, schemasRoot?: string): string {
  const base = path.basename(absPath).toLowerCase();
  const allIds: ReadonlyArray<string> =
    typeof schemasRoot === 'string' && schemasRoot.length > 0 ? collectSchemaIds(schemasRoot) : [];

  const findId = (needles: string[]): string | undefined =>
    allIds.find((id) => includesAny(id, needles));

  // Minimal MVS v1 heuristics
  if (includesAny(base, ['proofbundle', 'proof-bundle', 'proof_bundle'])) {
    const id = findId(['proofbundle', 'proof-bundle', 'proof_bundle']);
    if (id) return id;
  }
  if (includesAny(base, ['groth16', 'evm'])) {
    const id = findId(['groth16', 'evm']);
    if (id) return id;
  }
  if (includesAny(base, ['public', 'publicsignals'])) {
    const id = findId(['public', 'publicsignals']);
    if (id) return id;
  }
  if (includesAny(base, ['cir', 'circuit'])) {
    const id = findId(['cir', 'circuit', 'witness']);
    if (id) return id;
  }

  const hasRoot = typeof schemasRoot === 'string' && schemasRoot.length > 0;
  throw new Error(
    `Cannot infer schema for: ${absPath}\n` +
      (hasRoot
        ? `Checked ${allIds.length} schemas under ${schemasRoot}.\n`
        : `No schemasRoot provided; pass --schemas-root ./packages/core/schemas or set ZKPIP_SCHEMAS_ROOT.\n`) +
      `Rename the file to include a hint (e.g. "proof-bundle", "groth16-evm") or pass --schema-id explicitly.`,
  );
}
