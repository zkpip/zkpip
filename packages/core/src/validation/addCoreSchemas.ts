// packages/core/src/validation/addCoreSchemas.ts
// Load JSON schemas from filesystem (dist/schemas or repo-level schemas) to avoid
// JSON import assertions and stay compatible across Node versions.

import type Ajv2020 from "ajv/dist/2020";
import { CANONICAL_IDS } from "../schemaUtils.js";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// CanonicalId = "mvs.proof-bundle" | "mvs.cir" | "mvs.verification" | "mvs.issue" | "mvs.ecosystem"
export type CanonicalId =
  | "mvs.proof-bundle"
  | "mvs.cir"
  | "mvs.verification"
  | "mvs.issue"
  | "mvs.ecosystem"
  | "mvs.core";

function addAlias(ajv: Ajv2020, alias: string, targetUrn: string) {
  if (ajv.getSchema(alias)) return;
  ajv.addSchema({ $id: alias, $ref: targetUrn });
}

function register(
  ajv: Ajv2020,
  shortId:
    | "mvs.proof-bundle"
    | "mvs.cir"
    | "mvs.verification"
    | "mvs.issue"
    | "mvs.ecosystem"
    | "mvs.core",
  urn: string,
  raw: Record<string, unknown> & { $id?: string }
) {
  const base = raw.$id === urn ? raw : { ...raw, $id: urn };
  if (!ajv.getSchema(urn)) {
    ajv.addSchema(base);
  }

  const shortDot = shortId; // "mvs.proof-bundle"
  const shortSlash = shortId.replace(".", "/"); // "mvs/proof-bundle"
  const file = urn.split(":").pop()!; // "mvs.proof-bundle.schema.json"
  const https = `https://zkpip.org/schemas/${file}`;

  addAlias(ajv, shortDot, urn);
  addAlias(ajv, shortSlash, urn);
  addAlias(ajv, file, urn);
  addAlias(ajv, https, urn);
}

function resolveSchemasDir(currentFileUrl: string): string {
  // In dist: current file is dist/validation/addCoreSchemas.js
  // Prefer dist/schemas (..), then fall back to repo-level schemas (../..)
  const __filename = fileURLToPath(currentFileUrl);
  const __dirname = path.dirname(__filename);
  const candidates = [
    path.resolve(__dirname, "..", "schemas"),      // dist/validation -> dist/schemas
    path.resolve(__dirname, "..", "..", "schemas") // src/validation  -> repo/packages/core/schemas
  ];
  const found = candidates.find((p) => existsSync(p));
  if (!found) {
    throw new Error(
      `Core schemas directory not found. Tried: ${candidates.join(", ")}. ` +
      `Ensure build ran (postbuild copies schemas), or run from repository root where "packages/core/schemas" exists.`
    );
  }
  return found;
}

function loadSchemaJSON(schemasDir: string, fileName: string): Record<string, unknown> & { $id?: string } {
  const abs = path.join(schemasDir, fileName);
  const raw = readFileSync(abs, "utf8");
  return JSON.parse(raw) as Record<string, unknown> & { $id?: string };
}

export function addCoreSchemas(ajv: Ajv2020) {
  const schemasDir = resolveSchemasDir(import.meta.url);

  // Core first!!!
  register(ajv, "mvs.core", CANONICAL_IDS.core, loadSchemaJSON(schemasDir, "mvs.core.schema.json"));

  register(
    ajv,
    "mvs.verification",
    CANONICAL_IDS.verification,
    loadSchemaJSON(schemasDir, "mvs.verification.schema.json")
  );
  register(ajv, "mvs.issue", CANONICAL_IDS.issue, loadSchemaJSON(schemasDir, "mvs.issue.schema.json"));
  register(ajv, "mvs.ecosystem", CANONICAL_IDS.ecosystem, loadSchemaJSON(schemasDir, "mvs.ecosystem.schema.json"));
  register(
    ajv,
    "mvs.proof-bundle",
    CANONICAL_IDS.proofBundle,
    loadSchemaJSON(schemasDir, "mvs.proof-bundle.schema.json")
  );
  register(ajv, "mvs.cir", CANONICAL_IDS.cir, loadSchemaJSON(schemasDir, "mvs.cir.schema.json"));
}
