import fs from "fs";
import path from "path";
import Ajv from "ajv/dist/2020";
import addFormats from "ajv-formats";

const ROOT = process.cwd();
const SCHEMAS_DIR = path.join(ROOT, "schemas");
const VECTORS_DIR = path.join(SCHEMAS_DIR, "tests", "vectors");
const ECOSYSTEMS_DIR = path.join(ROOT, "ecosystems");

const CANONICAL_IDS: Record<string, string> = {
  "mvs.core.schema.json": "https://zkpip.org/schemas/mvs.core.schema.json",
  "mvs.ecosystem.schema.json": "https://zkpip.org/schemas/mvs.ecosystem.schema.json",
  "mvs.issue.schema.json": "https://zkpip.org/schemas/mvs.issue.schema.json",
  "mvs.verification.schema.json": "https://zkpip.org/schemas/mvs.verification.schema.json",
};

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

// --- utils ---
function listFilesRecursive(dir: string, pred: (name: string) => boolean, skipDirs: string[] = []): string[] {
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

function validateAgainst(refId: string, data: any, fileLabel: string) {
  try {
    const validate = ajv.getSchema(refId) || ajv.compile({ $ref: refId });
    const ok = validate(data);
    if (!ok) {
      console.error(`❌ ${fileLabel} failed (${refId}):`);
      console.error(ajv.errorsText(validate.errors, { separator: "\n" }));
      process.exit(1);
    }
    console.log(`✅ ${fileLabel} is valid (${refId})`);
  } catch (e: any) {
    console.error(`❌ ${fileLabel} could not be validated (${refId}):\n${e?.stack || e}`);
    process.exit(1);
  }
}

// --- load only the 4 core schemas, in order ---
function loadCoreSchemas(): void {
  const coreOrder = [
    "mvs.core.schema.json",
    "mvs.ecosystem.schema.json",
    "mvs.issue.schema.json",
    "mvs.verification.schema.json",
  ];

  for (const name of coreOrder) {
    const p = path.join(SCHEMAS_DIR, name);
    if (!fs.existsSync(p)) {
      console.error(`❌ Missing core schema: ${p}`);
      process.exit(1);
    }
    try {
      const schema = JSON.parse(fs.readFileSync(p, "utf8"));
      const canonical = CANONICAL_IDS[name];
      schema.$id = canonical;              // biztosítjuk az $id-t
      ajv.addSchema(schema, canonical);    // és ezen a kulcson regisztráljuk
    } catch (e: any) {
      console.error(`❌ Failed to load schema: ${p}\n${e?.stack || e}`);
      process.exit(1);
    }
  }
  console.log(`🔧 Loaded 4 core JSON Schemas.`);
}

function detectSchemaFromFilename(filePath: string): string {
  const name = path.basename(filePath).toLowerCase();
  if (name.startsWith("ecosystem"))     return CANONICAL_IDS["mvs.ecosystem.schema.json"];
  if (name.startsWith("issue"))         return CANONICAL_IDS["mvs.issue.schema.json"];
  if (name.startsWith("verification"))  return CANONICAL_IDS["mvs.verification.schema.json"];
  return CANONICAL_IDS["mvs.core.schema.json"];
}

function validateVectors(): void {
  console.log("🔍 Validating MVS test vectors...");
  const files = listFilesRecursive(VECTORS_DIR, n => n.endsWith(".json"));
  if (files.length === 0) {
    console.warn(`⚠️ No JSON files found under ${VECTORS_DIR}`);
    return;
  }
  for (const f of files) {
    const data = JSON.parse(fs.readFileSync(f, "utf8"));
    const ref = detectSchemaFromFilename(f);
    validateAgainst(ref, data, f);
  }
}

function validateDirWithSchema(dir: string, ref: string): void {
  const files = listFilesRecursive(dir, n => n.endsWith(".json"));
  for (const f of files) {
    const data = JSON.parse(fs.readFileSync(f, "utf8"));
    validateAgainst(ref, data, f);
  }
}

(function main() {
  loadCoreSchemas();
  validateVectors();

  console.log("🔍 Validating ecosystems (recursive, excluding /extensions)...");
  const files = listFilesRecursive(ECOSYSTEMS_DIR, n => n.endsWith(".json"), ["extensions"]);
  for (const f of files) {
    const data = JSON.parse(fs.readFileSync(f, "utf8"));
    validateAgainst(CANONICAL_IDS["mvs.ecosystem.schema.json"], data, f);
  }

  console.log("🎉 MVS schema validation complete.");
})();
