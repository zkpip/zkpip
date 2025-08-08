import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
// ✅ Import from the built output, not the TS source
import { makeAjv } from "../dist/validation/ajv.js";

const ajv = makeAjv();
const samplesDir = resolve(process.cwd(), "data", "samples");
const files = readdirSync(samplesDir).filter((f) => f.endsWith(".json"));

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
