import fs from "node:fs";
import path from "node:path";
import type { ErrorObject } from "ajv";
import { addCoreSchemas, type CanonicalId } from "../validation/addCoreSchemas.js";
import { createAjv } from "../validation/ajv.js";
import { CANONICAL_IDS } from "../schemaUtils.js";

// --- Types ---
type VectorCanonicalId = Exclude<CanonicalId, "mvs.core">;

// --- IO helpers ---
function listJsonFiles(inputPath: string): string[] {
  const st = fs.statSync(inputPath);
  if (st.isFile()) return inputPath.toLowerCase().endsWith(".json") ? [inputPath] : [];
  const out: string[] = [];
  const stack = [inputPath];
  while (stack.length) {
    const dir = stack.pop()!;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) stack.push(p);
      else if (ent.isFile() && p.toLowerCase().endsWith(".json")) out.push(p);
    }
  }
  return out.sort((a, b) => a.localeCompare(b));
}

// Only vector-related schema IDs (no "mvs.core" here)
const SHORT_CANDIDATES: readonly VectorCanonicalId[] = [
  "mvs.proof-bundle",
  "mvs.cir",
  "mvs.verification",
  "mvs.issue",
  "mvs.ecosystem",
] as const;

/** Type guard for narrowing arbitrary string to VectorCanonicalId */
function isVectorCanonicalIdStr(s: string): s is VectorCanonicalId {
  return (SHORT_CANDIDATES as readonly string[]).includes(s);
}

/**
 * Map short IDs to their canonical URNs for vector-related schemas only.
 * Using `satisfies` ensures we cover all VectorCanonicalId keys at compile time.
 */
const SHORT_TO_URN = {
  "mvs.verification": CANONICAL_IDS.verification,
  "mvs.issue":        CANONICAL_IDS.issue,
  "mvs.ecosystem":    CANONICAL_IDS.ecosystem,
  "mvs.proof-bundle": CANONICAL_IDS.proofBundle,
  "mvs.cir":          CANONICAL_IDS.cir,
} as const satisfies Record<VectorCanonicalId, string>;

/** Normalize incoming $schema ref to a VectorCanonicalId (if applicable) */
function toShortId(schemaRef?: string): VectorCanonicalId | undefined {
  if (!schemaRef) return undefined;
  const s = schemaRef.trim().toLowerCase();

  if (isVectorCanonicalIdStr(s)) return s;

  for (const [shortId, urn] of Object.entries(SHORT_TO_URN) as [VectorCanonicalId, string][]) {
    if (urn.toLowerCase() === s) return shortId;
  }

  const tail = s.split("/").pop() || s;
  if (tail === "mvs.proof-bundle.schema.json") return "mvs.proof-bundle";
  if (tail === "mvs.cir.schema.json")          return "mvs.cir";
  if (tail === "mvs.verification.schema.json") return "mvs.verification";
  if (tail === "mvs.issue.schema.json")        return "mvs.issue";
  if (tail === "mvs.ecosystem.schema.json")    return "mvs.ecosystem";
  return undefined;
}

function formatAjvErrors(errors?: ErrorObject[] | null): string {
  if (!errors?.length) return "(no AJV errors captured)";
  return errors.map(e => `${e.instancePath || "/"} ${e.message} ${JSON.stringify(e.params)}`).join("; ");
}

export async function validatePath(inputPath: string): Promise<void> {
  const files = listJsonFiles(inputPath);
  const ajv   = createAjv();
  addCoreSchemas(ajv);

  for (const file of files) {
    const raw  = fs.readFileSync(file, "utf8");
    const data = JSON.parse(raw);

    // Prefer vector schema hinted by $schema, then fall back to the rest
    const preferredShort = toShortId(data?.$schema);
    const candidates: VectorCanonicalId[] = preferredShort
      ? [preferredShort, ...SHORT_CANDIDATES.filter(x => x !== preferredShort)]
      : [...SHORT_CANDIDATES];

    let anyOk = false;
    const errs: Record<string, string> = {};

    for (const shortId of candidates) {
      let v = ajv.getSchema(shortId); // short alias

      if (!v) v = ajv.getSchema(SHORT_TO_URN[shortId]); // canonical URN

      if (!v) {
        errs[shortId] = "(schema not registered: short alias and URN missing)";
        continue;
      }

      if (v(data)) { anyOk = true; break; }
      errs[shortId] = formatAjvErrors(v.errors);
    }

    if (!anyOk) {
      const pretty = Object.entries(errs).map(([id, m]) => ` - ${id}: ${m}`).join("\n");
      throw new Error(`Validation failed for ${file}:\n${pretty}`);
    }
  }
}
