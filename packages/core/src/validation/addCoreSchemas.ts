// packages/core/src/validation/addCoreSchemas.ts
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import type { AnySchemaObject, ValidateFunction } from "ajv";
import { CANONICAL_IDS } from "../schemaUtils.js";
import { ALIASES, httpsAliasOf } from "./aliases.js";

interface AjvLike {
  addSchema(schema: AnySchemaObject): unknown;
  getSchema(id: string): ValidateFunction | undefined;
}

function resolveSchemasDir(explicit?: string): string {
  if (explicit && fs.existsSync(explicit)) return explicit;
  const env = process.env.ZKPIP_SCHEMAS_DIR;
  if (env && fs.existsSync(env)) return env;

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const candidates = [
    path.resolve(__dirname, "../../schemas"),              // packages/core/schemas
    path.resolve(process.cwd(), "packages/core/schemas"),  // workspace fallback
  ];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  throw new Error("Schemas dir not found. Set ZKPIP_SCHEMAS_DIR or ensure packages/core/schemas exists.");
}

// Allow string | string[] so we can try multiple filenames for 'core'
function loadSchema(dir: string, names: string | string[]): AnySchemaObject {
  const list = Array.isArray(names) ? names : [names];
  for (const name of list) {
    const p = path.join(dir, name);
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, "utf8")) as AnySchemaObject;
    }
  }
  throw new Error(`Schema file not found. Tried: ${list.join(" | ")}`);
}

/** Add schema only if not already present (by known/canonical id). */
function safeAddCanonicalSchema(
  ajv: AjvLike,
  canonicalId: string,
  schema: AnySchemaObject
): void {
  // If already registered, skip
  if (ajv.getSchema(canonicalId)) return;
  ajv.addSchema(schema);
}

/** Add aliases only if not already present. */
function registerAliasesIdempotent(
  ajv: AjvLike,
  canonicalId: string,
  aliases: readonly string[]
): void {
  for (const id of aliases) {
    if (!ajv.getSchema(id)) {
      ajv.addSchema({ $id: id, $ref: canonicalId } as AnySchemaObject);
    }
  }
}

export function addCoreSchemas(ajv: AjvLike, opts?: { schemasDir?: string }): void {
  const dir = resolveSchemasDir(opts?.schemasDir);

  const FILES: Record<
    "core" | "verification" | "proofBundle" | "cir" | "issue" | "ecosystem",
    string | string[]
  > = {
    core:         ["mvs.core.schema.json", "mvs.core.payload.schema.json"],
    verification: "mvs.verification.schema.json",
    proofBundle:  "mvs.proof-bundle.schema.json",
    cir:          "mvs.cir.schema.json",
    issue:        "mvs.issue.schema.json",
    ecosystem:    "mvs.ecosystem.schema.json",
  };

  // 1) Canonical schemas — add only once
  safeAddCanonicalSchema(ajv, CANONICAL_IDS.core,         loadSchema(dir, FILES.core));
  safeAddCanonicalSchema(ajv, CANONICAL_IDS.verification, loadSchema(dir, FILES.verification));
  safeAddCanonicalSchema(ajv, CANONICAL_IDS.proofBundle,  loadSchema(dir, FILES.proofBundle));
  safeAddCanonicalSchema(ajv, CANONICAL_IDS.cir,          loadSchema(dir, FILES.cir));
  safeAddCanonicalSchema(ajv, CANONICAL_IDS.issue,        loadSchema(dir, FILES.issue));
  safeAddCanonicalSchema(ajv, CANONICAL_IDS.ecosystem,    loadSchema(dir, FILES.ecosystem));

  // 2) Aliases — add only if missing
  for (const [canonicalId, aliasList] of Object.entries(ALIASES)) {
    registerAliasesIdempotent(ajv, canonicalId, aliasList);
    const https = httpsAliasOf(canonicalId);
    registerAliasesIdempotent(ajv, canonicalId, [https]);
  }
}
