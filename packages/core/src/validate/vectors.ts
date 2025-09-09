// packages/core/src/validate/vectors.ts
import fs from "node:fs";
import path from "node:path";
import type { ErrorObject } from "ajv";
import { addCoreSchemas } from "../validation/addCoreSchemas.js";
import { createAjv } from "../validation/ajv.js";
import { CANONICAL_IDS } from "../constants/canonicalIds.js";
import type { AjvLike } from "../validation/ajv-types.js";

type CanonicalUrn = typeof CANONICAL_IDS[keyof typeof CANONICAL_IDS];

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

const ALL_URNS: CanonicalUrn[] = [
  CANONICAL_IDS.proofBundle,
  CANONICAL_IDS.cir,
  CANONICAL_IDS.verification,
  CANONICAL_IDS.issue,
  CANONICAL_IDS.ecosystem,
  // ha kell:
  // CANONICAL_IDS.core,
];

function normalizeSchemaRef(schemaRef?: string): CanonicalUrn | undefined {
  if (!schemaRef || typeof schemaRef !== "string") return undefined;
  const s = schemaRef.trim();

  // már kánonikus URN?
  if ((ALL_URNS as readonly string[]).includes(s)) return s as CanonicalUrn;

  // régi URN → új URN
  switch (s) {
    case "urn:zkpip:mvs.proof-bundle.schema.json": return CANONICAL_IDS.proofBundle;
    case "urn:zkpip:mvs.cir.schema.json": return CANONICAL_IDS.cir;
    case "urn:zkpip:mvs.verification.schema.json": return CANONICAL_IDS.verification;
    case "urn:zkpip:mvs.issue.schema.json": return CANONICAL_IDS.issue;
    case "urn:zkpip:mvs.ecosystem.schema.json": return CANONICAL_IDS.ecosystem;
  }

  // tail alapján (új + régi)
  const tail = s.split("/").pop()!.toLowerCase();
  switch (tail) {
    case "proofbundle.schema.json": return CANONICAL_IDS.proofBundle;
    case "cir.schema.json": return CANONICAL_IDS.cir;
    case "verification.schema.json": return CANONICAL_IDS.verification;
    case "issue.schema.json": return CANONICAL_IDS.issue;
    case "ecosystem.schema.json": return CANONICAL_IDS.ecosystem;
    case "mvs.proof-bundle.schema.json": return CANONICAL_IDS.proofBundle;
    case "mvs.cir.schema.json": return CANONICAL_IDS.cir;
    case "mvs.verification.schema.json": return CANONICAL_IDS.verification;
    case "mvs.issue.schema.json": return CANONICAL_IDS.issue;
    case "mvs.ecosystem.schema.json": return CANONICAL_IDS.ecosystem;
  }

  return undefined;
}

function formatAjvErrors(errors?: ErrorObject[] | null): string {
  if (!errors?.length) return "(no AJV errors captured)";
  return errors.map((e) => `${e.instancePath || "/"} ${e.message} ${JSON.stringify(e.params)}`).join("; ");
}

export async function validatePath(inputPath: string): Promise<void> {
  const files = listJsonFiles(inputPath);
  const ajv: AjvLike = createAjv();   
  addCoreSchemas(ajv);

  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(file, "utf8"));

    const preferred = normalizeSchemaRef(data?.$schema);
    const candidates = preferred ? [preferred, ...ALL_URNS.filter((u) => u !== preferred)] : ALL_URNS;

    let anyOk = false;
    const errs: Record<string, string> = {};

    for (const urn of candidates) {
      const ok = ajv.validate({ $ref: urn }, data);
      if (ok) { anyOk = true; break; }
      errs[urn] = formatAjvErrors(ajv.errors);
    }

    if (!anyOk) {
      const pretty = Object.entries(errs).map(([id, m]) => ` - ${id}: ${m}`).join("\n");
      throw new Error(`Validation failed for ${file}:\n${pretty}`);
    }
  }
}
