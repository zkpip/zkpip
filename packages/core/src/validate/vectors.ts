import fs from "node:fs";
import path from "node:path";
import type { ErrorObject } from "ajv";
import { addCoreSchemas, type CanonicalId } from "../validation/addCoreSchemas";
import { createAjv } from "../validation/ajv";
import { CANONICAL_IDS } from "../schemaUtils";

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

const SHORT_CANDIDATES: CanonicalId[] = [
  "mvs.proof-bundle",
  "mvs.cir",
  "mvs.verification",
  "mvs.issue",
  "mvs.ecosystem",
];

const SHORT_TO_URN: Record<CanonicalId, string> = {
  "mvs.proof-bundle": CANONICAL_IDS.proofBundle,
  "mvs.cir":          CANONICAL_IDS.cir,
  "mvs.verification": CANONICAL_IDS.verification,
  "mvs.issue":        CANONICAL_IDS.issue,
  "mvs.ecosystem":    CANONICAL_IDS.ecosystem,
};

function toShortId(schemaRef?: string): CanonicalId | undefined {
  if (!schemaRef) return undefined;
  const s = schemaRef.trim().toLowerCase();

  // eleve rövid alias?
  if ((SHORT_CANDIDATES as readonly string[]).includes(s)) {
    return s as CanonicalId;
  }
  // URN pontos egyezés?
  for (const [shortId, urn] of Object.entries(SHORT_TO_URN) as [CanonicalId, string][]) {
    if (urn.toLowerCase() === s) return shortId;
  }
  // fájlnév / URL utolsó komponense alapján
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

    // $schema alapján preferált rövid ID
    const preferredShort = toShortId(data?.$schema);
    const candidates: CanonicalId[] = preferredShort
      ? [preferredShort, ...SHORT_CANDIDATES.filter(x => x !== preferredShort)]
      : SHORT_CANDIDATES;

    let anyOk = false;
    const errs: Record<string, string> = {};

    for (const shortId of candidates) {
      // 1) próbáljuk rövid azonosítóval
      let v = ajv.getSchema(shortId);
      // 2) ha nincs regisztrálva a rövid alias, próbáljuk az URN-nel (fallback)
      if (!v) v = ajv.getSchema(SHORT_TO_URN[shortId]);

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
