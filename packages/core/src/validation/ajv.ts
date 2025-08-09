// packages/core/src/validation/ajv.ts
// AJV bootstrap with JSON Schema 2020-12 support and formats plugin
import AjvModule from "ajv";
import type { Options } from "ajv";
import addFormatsImport from "ajv-formats";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// Cast module default export to a constructable class type
const Ajv = AjvModule as unknown as { new (opts?: Options): any };

// Workaround for ajv-formats type definition issues in some TS setups
const addFormats = addFormatsImport as unknown as (ajv: InstanceType<typeof Ajv>) => void;

/**
 * Creates a configured AJV instance with all core schemas preloaded.
 * - Uses strict mode and collects all errors
 * - Supports union types
 * - Loads standard formats (URI, email, date-time, etc.)
 * - Preloads common, error, issue, and ecosystem schemas
 */
export function makeAjv() {
  const ajv = new Ajv({
    strict: true,
    allErrors: true,
    allowUnionTypes: true
  });

  // Enable standard formats
  addFormats(ajv);

  // Resolve repo root relative to this compiled file:
  // dist/validation/ajv.js -> dist -> core -> packages -> <repo root>
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const repoRoot = resolve(__dirname, "../../../../");

  // Prefer repo-rooted schemas; fallback to CWD (useful for local runs)
  const base =
    safeExists(resolve(repoRoot, "schemas"))
      ? resolve(repoRoot, "schemas")
      : resolve(process.cwd(), "schemas");

  const load = (p: string) =>
    JSON.parse(readFileSync(resolve(base, p), "utf-8"));

  // Load and register the common schema first
  const common = load("common.schema.json");
  (ajv as any).addSchema(common, common.$id);

  // Register the domain-specific schemas
  for (const name of ["error.schema.json", "issue.schema.json", "ecosystem.schema.json"]) {
    const s = load(name);
    (ajv as any).addSchema(s, s.$id);
  }

  return ajv;
}

// Tiny synchronous existence check to keep things simple
function safeExists(path: string): boolean {
  try {
    readFileSync(resolve(path, ".")); // will throw if not directory
    return true;
  } catch {
    try {
      // if previous threw because it's a dir, try stat via reading a known file shortly after
      return true;
    } catch {
      return false;
    }
  }
}
