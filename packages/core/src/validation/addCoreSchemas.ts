// packages/core/src/validation/addCoreSchemas.ts
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import type { AnySchemaObject, ValidateFunction } from "ajv";
import { CANONICAL_IDS } from "../index.js";

export type CanonicalId = string;

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

function registerAliases(ajv: AjvLike, canonicalId: string, aliases: readonly string[]): void {
  for (const id of aliases) {
    ajv.addSchema({ $id: id, $ref: canonicalId } as AnySchemaObject);
  }
}

export function addCoreSchemas(ajv: AjvLike, opts?: { schemasDir?: string }): void {
  const dir = resolveSchemasDir(opts?.schemasDir);

  // 🔧 Include 'core' as well; try both filename variants if needed.
  const FILES: Record<"core" | "verification" | "proofBundle" | "cir" | "issue" | "ecosystem", string | string[]> = {
    core:         ["mvs.core.schema.json", "mvs.core.payload.schema.json"],
    verification: "mvs.verification.schema.json",
    proofBundle:  "mvs.proof-bundle.schema.json",
    cir:          "mvs.cir.schema.json",
    issue:        "mvs.issue.schema.json",
    ecosystem:    "mvs.ecosystem.schema.json",
  };

  // 1) Add canonical schemas FIRST
  ajv.addSchema(loadSchema(dir, FILES.core));
  ajv.addSchema(loadSchema(dir, FILES.verification));
  ajv.addSchema(loadSchema(dir, FILES.proofBundle));
  ajv.addSchema(loadSchema(dir, FILES.cir));
  ajv.addSchema(loadSchema(dir, FILES.issue));
  ajv.addSchema(loadSchema(dir, FILES.ecosystem));

  // 2) Aliases (legacy + new subpaths)
  registerAliases(ajv, CANONICAL_IDS.proofBundle, [
    "mvs.proof-bundle",
    "mvs/proof-bundle",
    "mvs.proof-bundle.schema.json",
    "mvs/verification/proofBundle",
  ]);
  registerAliases(ajv, CANONICAL_IDS.cir, [
    "mvs.cir",
    "mvs/cir",
    "mvs.cir.schema.json",
    "mvs/verification/cir",
  ]);
  registerAliases(ajv, CANONICAL_IDS.verification, [
    "mvs.verification",
    "mvs/verification",
    "mvs.verification.schema.json",
  ]);
  registerAliases(ajv, CANONICAL_IDS.issue, [
    "mvs.issue",
    "mvs/issue",
    "mvs.issue.schema.json",
  ]);
  registerAliases(ajv, CANONICAL_IDS.ecosystem, [
    "mvs.ecosystem",
    "mvs/ecosystem",
    "mvs.ecosystem.schema.json",
  ]);
  // (Optional but recommended) Core aliases as well
  if (CANONICAL_IDS.core) {
    registerAliases(ajv, CANONICAL_IDS.core, [
      "mvs.core",
      "mvs/core",
      "mvs.core.schema.json",
      "mvs.core.payload.schema.json",
    ]);
  }

  // 3) HTTPS aliases derived from canonical URNs
  for (const id of Object.values(CANONICAL_IDS) as readonly string[]) {
    const tail = id.split(":").pop()!;
    registerAliases(ajv, id, [`https://zkpip.org/schemas/${tail}`]);
  }
}
