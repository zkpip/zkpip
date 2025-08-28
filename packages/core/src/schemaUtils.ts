// AJV bootstrap helpers for loading repository JSON Schemas.

import type { Options as AjvOptions, ErrorObject } from "ajv";
import * as AjvNS from "ajv";
import addFormatsOrig from "ajv-formats";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import path from "path";

type ValidateFunction = ((data: unknown) => boolean) & {
  errors?: ErrorObject[] | null;
};

export interface AjvInstance {
  addSchema(schema: Record<string, unknown>, key?: string): unknown;
  getSchema(id: string): ValidateFunction | undefined;
  errorsText(
    errors?: ErrorObject[] | null,
    opts?: { separator?: string }
  ): string;
}

type AjvCtor = new (opts?: AjvOptions) => AjvInstance;
const Ajv = (AjvNS as unknown as { default: AjvCtor }).default;

const addFormats: (ajv: unknown) => unknown = addFormatsOrig as unknown as (
  ajv: unknown
) => unknown;

export const CANONICAL_IDS = {
  core: "urn:zkpip:mvs.core.schema.json",
  verification: "urn:zkpip:mvs.verification.schema.json",
  issue: "urn:zkpip:mvs.issue.schema.json",
  ecosystem: "urn:zkpip:mvs.ecosystem.schema.json",
  proofBundle: "urn:zkpip:mvs.proof-bundle.schema.json",
  cir: "urn:zkpip:mvs.cir.schema.json",
} as const;

type CanonicalKey = keyof typeof CANONICAL_IDS;

function isCanonicalKey(x: string): x is CanonicalKey {
  return x in CANONICAL_IDS;
}

function getCanonicalId(idKey: string) {
  if (!isCanonicalKey(idKey)) {
    throw new Error(`Unknown canonical key: ${idKey}`);
  }
  return CANONICAL_IDS[idKey]; // OK
}

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

export function createAjv() {
  const ajv = new Ajv({
    strict: false,
    allErrors: true,
    validateSchema: false,
  });

  addFormats(ajv);
  return ajv;
}

export function schemasDir(): string {
  const override = process.env.ZKPIP_SCHEMAS_DIR;
  if (override && override.trim()) {
    return resolve(override);
  }
  return repoSchemasDirFromHere();
}

export function readJson<T = unknown>(p: string): T {
  if (!existsSync(p)) {
    throw new Error(`Schema file not found at: ${p}`);
  }
  const raw = readFileSync(p, "utf8");
  try {
    return JSON.parse(raw) as T;
  } catch (e) {
    throw new Error(`Invalid JSON in schema file: ${p} — ${(e as Error).message}`);
  }
}

const URN_RE = /^urn:[a-z0-9][a-z0-9-]{0,31}:.+/i;

function assertValidUrn(id: string, where: string) {
  if (!URN_RE.test(id)) {
    throw new Error(`Invalid URN at ${where}: "${id}"  (expected "urn:<nid>:<nss>")`);
  }
}

function* walkRefs(obj: unknown, path: string[] = []): Generator<{ref:string; where:string}> {
  if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const here = [...path, k];
      if (k === "$ref" && typeof v === "string") {
        yield { ref: v, where: `$.${here.join(".")}` };
      } else {
        yield* walkRefs(v, here);
      }
    }
  }
}

function preflightSchemaIdsAndRefs(schema: any, fileTag: string) {
  if (typeof schema.$schema === "string" && schema.$schema.startsWith("urn:")) {
    throw new Error(`$schema must be a draft URL, not URN. Found at ${fileTag}: ${schema.$schema}`);
  }
  
  if (typeof schema.$id === "string" && schema.$id.startsWith("urn:")) {
    assertValidUrn(schema.$id, `${fileTag}.$id`);
  }
  
  for (const { ref, where } of walkRefs(schema)) {
    if (ref.startsWith("urn:")) assertValidUrn(ref, `${fileTag}:${where}`);
  }
}

export function addCoreSchemas(ajv: AjvInstance): void {
  const base = schemasDir(); 

  const sources: Array<{ id: string; candidates: string[] }> = [
    { id: CANONICAL_IDS.core,         candidates: ["mvs.core.schema.json", "common.schema.json"] },
    { id: CANONICAL_IDS.verification, candidates: ["mvs.verification.schema.json", "error.schema.json"] },
    { id: CANONICAL_IDS.issue,        candidates: ["mvs.issue.schema.json", "issue.schema.json"] },
    { id: CANONICAL_IDS.ecosystem,    candidates: ["mvs.ecosystem.schema.json", "ecosystem.schema.json"] },
    { id: CANONICAL_IDS.proofBundle,  candidates: ["mvs.proof-bundle.schema.json"] },
    { id: CANONICAL_IDS.cir,          candidates: ["mvs.cir.schema.json"] },
  ];

  for (const { id, candidates } of sources) {
    let schema: Record<string, unknown>;
    try {
      schema = loadFirstExistingSchema(base, candidates);
    } catch {
      // ezt várja a teszt:
      throw new Error(`Missing core schema: ${candidates.join(" | ")} in ${base}`);
    }

    (schema as any).$id = id;
    assertValidUrn(id, `addCoreSchemas:$id(${candidates[0] ?? "unknown"})`);
    preflightSchemaIdsAndRefs(schema, `schema:${id}`);
    ajv.addSchema(schema, id);
  }
}

