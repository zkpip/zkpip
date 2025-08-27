// scripts/validateSchemas.mts
import fs from "fs";
import path from "path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { CANONICAL_IDS } from "../packages/core/src/schemaUtils.js";

// --- constants/paths ---
const ROOT = process.cwd();
const SCHEMAS_DIR = path.join(ROOT, "schemas");
const VECTORS_DIR = path.join(SCHEMAS_DIR, "tests", "vectors");
const ECOSYSTEMS_DIR = path.join(ROOT, "ecosystems");

// --- ajv instance ---
const ajv = new Ajv2020({
  strict: true,
  allErrors: true,
  allowUnionTypes: true, // MVS v0.1: short union type syntax support
});
addFormats(ajv);

// --- utils ---
function listFilesRecursive(
  dir: string,
  pred: (name: string) => boolean,
  skipDirs: string[] = []
): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) {
        if (skipDirs.includes(e.name)) continue;
        walk(full);
      } else if (e.isFile() && pred(e.name)) {
        out.push(full);
      }
    }
  };
  walk(dir);
  return out;
}

type FailedResult = { ok: false; errors: string[]; refId: string; fileLabel: string };
type ValidateResult = { ok: true } | FailedResult;

function validateAgainstResult(refId: string, data: unknown, fileLabel: string): ValidateResult {
  try {
    const validate =
      ajv.getSchema(refId) ??
      ajv.compile({
        $ref: refId, // URN form
      });

    const ok = validate(data);
    if (ok) return { ok: true };

    const errors = (validate.errors ?? []).map(e =>
      ajv.errorsText([e], { separator: "\n" })
    );
    return { ok: false, errors, refId, fileLabel };
  } catch (e: any) {
    return {
      ok: false,
      errors: [String(e?.stack || e)],
      refId,
      fileLabel,
    };
  }
}

// --- load only the 4 core schemas, in order ---
function loadCoreSchemas(): void {
  const CORE_ENTRIES: Array<{ id: string; filename: string }> = [
    { id: CANONICAL_IDS.core,         filename: "mvs.core.schema.json" },
    { id: CANONICAL_IDS.ecosystem,    filename: "mvs.ecosystem.schema.json" },
    { id: CANONICAL_IDS.issue,        filename: "mvs.issue.schema.json" },
    { id: CANONICAL_IDS.verification, filename: "mvs.verification.schema.json" },
  ];

  for (const { id, filename } of CORE_ENTRIES) {
    const abs = path.join(SCHEMAS_DIR, filename);
    if (!fs.existsSync(abs)) {
      console.error(`❌ Missing core schema file: ${abs}`);
      process.exit(1); // core nélkül nem értelmezhető a további validáció
    }
    try {
      const schema = JSON.parse(fs.readFileSync(abs, "utf8"));
      if (schema.$id !== id) {
        throw new Error(
          `Schema $id mismatch for ${filename}: expected ${id}, got ${schema.$id}`
        );
      }
      ajv.addSchema(schema); // $id (URN) registration
    } catch (e: any) {
      console.error(`❌ Failed to load schema: ${abs}\n${e?.stack || e}`);
      process.exit(1);
    }
  }
  console.log(`🔧 Loaded 4 core JSON Schemas.`);
}

function detectSchemaFromFilename(filePath: string): string {
  const name = path.basename(filePath).toLowerCase();
  // legacy tolerance: "error" → verification
  if (name.includes("verification") || name.includes("error"))
    return CANONICAL_IDS.verification;
  if (name.includes("issue"))        return CANONICAL_IDS.issue;
  if (name.includes("ecosystem"))    return CANONICAL_IDS.ecosystem;
  return CANONICAL_IDS.core;
}

function parseJsonFileOrCollect(filePath: string, failures: FailedResult[]): unknown | null {
  const raw = fs.readFileSync(filePath, "utf8");
  try {
    return JSON.parse(raw);
  } catch (e: any) {
    failures.push({
      ok: false,
      refId: "json.parse",
      fileLabel: filePath,
      errors: [e?.message || String(e)],
    });
    return null;
  }
}

(function main() {
  loadCoreSchemas();

  const failures: FailedResult[] = [];   // <- csak hibás eredmények
  let validatedCount = 0;

  // ... (változatlan kód a fájlok bejárásáig) ...

  // --- összegzés ---
  const failCount = failures.length;
  const okCount = validatedCount - failCount;

  if (failCount === 0) {
    console.log(`🎉 MVS schema validation complete. All ${okCount} document(s) are valid.`);
    process.exitCode = 0;
    return;
  }

  console.error("\n⛔ Validation failures summary:");
  for (const f of failures) {
    // Itt már biztosan FailedResult, ezért van fileLabel, refId, errors
    console.error(`\n— File: ${f.fileLabel}`);
    console.error(`  Ref : ${f.refId}`);
    for (const line of f.errors) {
      console.error(`  Err : ${line}`);
    }
  }

  console.error(`\n❌ Validation finished with ${failCount} failure(s) out of ${validatedCount} file(s).`);
  process.exitCode = 1;
})();

