// AJV bootstrap with JSON Schema 2020-12 support and formats plugin
import Ajv2020Module from "ajv/dist/2020.js";
import type { Options } from "ajv";
import addFormatsImport from "ajv-formats";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// Cast module default export to a constructable class type (TS workaround)
const Ajv2020 = Ajv2020Module as unknown as { new (opts?: Options): any };

// ajv-formats sometimes mis-types; keep it simple:
const addFormats = addFormatsImport as unknown as (ajv: InstanceType<typeof Ajv2020>) => void;

/**
 * Creates a configured AJV instance with all core schemas preloaded.
 * - Uses strict mode and collects all errors
 * - Supports union types
 * - Loads standard formats (URI, email, date-time, etc.)
 * - Preloads common, error, issue, and ecosystem schemas
 * Note: Ajv 2020 build already registers the JSON Schema 2020-12 meta-schema.
 */
export function makeAjv() {
  const ajv = new Ajv2020({
    strict: true,
    allErrors: true,
    allowUnionTypes: true,
  } as Options);

  addFormats(ajv);

  // Resolve repo root from this compiled file:
  // dist/validation/ajv.js -> dist -> core -> packages -> <repo root>
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const repoRoot = resolve(__dirname, "../../../../");

  // Prefer <repo>/schemas; fallback to CWD for local runs
  const base = existsSync(resolve(repoRoot, "schemas"))
    ? resolve(repoRoot, "schemas")
    : resolve(process.cwd(), "schemas");

  const load = (p: string) =>
    JSON.parse(readFileSync(resolve(base, p), "utf-8"));

  // Load and register the common schema first
  const common = load("common.schema.json");
  (ajv as any).addSchema(common, common.$id);

  // Register domain-specific schemas
  for (const name of ["error.schema.json", "issue.schema.json", "ecosystem.schema.json"]) {
    const s = load(name);
    (ajv as any).addSchema(s, s.$id);
  }

  return ajv;
}
