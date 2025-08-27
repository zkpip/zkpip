// AJV bootstrap helpers for loading repository JSON Schemas.
import * as Ajv2020NS from "ajv/dist/2020.js";
import * as addFormatsNS from "ajv-formats";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import path from "path";

export const CANONICAL_IDS = {
  core: "urn:zkpip:mvs.core.schema.json",
  verification: "urn:zkpip:mvs.verification.schema.json",
  issue: "urn:zkpip:mvs.issue.schema.json",
  ecosystem: "urn:zkpip:mvs.ecosystem.schema.json",
  proofBundle: "urn:zkpip:mvs.proof-bundle.schema.json",
  cir: "urn:zkpip:mvs.cir.schema.json",
} as const;

export function vectorsDir(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const repoRoot = path.resolve(__dirname, "../../..");
  return path.join(repoRoot, "schemas", "tests", "vectors", "mvs");
}

function findSchemasDir(startDir: string): string | null {
  let dir = startDir;
  for (let i = 0; i < 8; i++) {
    const candidate = resolve(dir, "schemas");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/** Resolve the /schemas directory robustly from compiled file location or CWD. */
function repoSchemasDirFromHere(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);

  const fromDist = findSchemasDir(__dirname);
  if (fromDist) return fromDist;

  const fromCwd = findSchemasDir(process.cwd());
  if (fromCwd) return fromCwd;

  // last resort
  return resolve(process.cwd(), "schemas");
}

function readSchema(baseDir: string, filename: string): Record<string, unknown> | null {
  const abs = resolve(baseDir, filename);
  if (!existsSync(abs)) return null;
  return JSON.parse(readFileSync(abs, "utf-8")) as Record<string, unknown>;
}

function loadFirstExistingSchema(baseDir: string, candidates: string[]): Record<string, unknown> {
  for (const fn of candidates) {
    const json = readSchema(baseDir, fn);
    if (json) return json;
  }
  throw new Error(`Schema file not found. Looked for: ${candidates.join(", ")} in ${baseDir}`);
}

const Ajv2020 = (Ajv2020NS as unknown as { default: new (opts?: any) => any }).default;
const addFormats = (addFormatsNS as any).default ?? addFormatsNS;

/** Create a strict AJV instance (JSON Schema 2020-12) with formats. */
export function createAjv() {
  const ajv = new Ajv2020({ strict: true, allErrors: true, allowUnionTypes: true });
  addFormats(ajv);
  return ajv;
}

/** Use the concrete instance type returned by createAjv (no Ajv type import needed). */
type AjvInstance = ReturnType<typeof createAjv>;

export function addCoreSchemas(ajv: AjvInstance): void {
  const base = repoSchemasDirFromHere();

  const sources: Array<{ id: string; candidates: string[] }> = [
    { id: CANONICAL_IDS.core,         candidates: ["mvs.core.schema.json", "common.schema.json"] },
    { id: CANONICAL_IDS.verification, candidates: ["mvs.verification.schema.json", "error.schema.json"] },
    { id: CANONICAL_IDS.issue,        candidates: ["mvs.issue.schema.json", "issue.schema.json"] },
    { id: CANONICAL_IDS.ecosystem,    candidates: ["mvs.ecosystem.schema.json", "ecosystem.schema.json"] },
    { id: CANONICAL_IDS.proofBundle,  candidates: ["mvs.proof-bundle.schema.json"] },
    { id: CANONICAL_IDS.cir,          candidates: ["mvs.cir.schema.json"] },
  ];

  for (const { id, candidates } of sources) {
    const schema = loadFirstExistingSchema(base, candidates);
    ajv.addSchema(schema, id);
  }
}
