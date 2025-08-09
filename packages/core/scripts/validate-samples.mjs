// packages/core/scripts/validate-samples.mjs
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { makeAjv } from "../dist/validation/ajv.js";

// Resolve repo root relative to this script:
// packages/core/scripts -> core -> packages -> <repo root>
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "../../../");

// Use data/samples from repo root
const samplesDir = resolve(repoRoot, "data", "samples");
const files = readdirSync(samplesDir).filter((f) => f.endsWith(".json"));

const ajv = makeAjv();

let failed = 0;
for (const f of files) {
  const json = JSON.parse(readFileSync(resolve(samplesDir, f), "utf-8"));
  const schemaId = /error/i.test(f)
    ? "https://zkpip.org/schemas/error.schema.json"
    : /issue/i.test(f)
    ? "https://zkpip.org/schemas/issue.schema.json"
    : "https://zkpip.org/schemas/ecosystem.schema.json";
  const v = ajv.getSchema(schemaId);
  const ok = v && v(json);
  if (!ok) {
    failed++;
    console.error(`❌ ${f} failed:`, v?.errors);
  } else {
    console.log(`✅ ${f} valid against ${schemaId}`);
  }
}
if (failed) process.exit(1);
