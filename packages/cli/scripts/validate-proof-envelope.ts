// ESM + strict TS, no 'any'.
// Validates one or more JSON files against ProofEnvelope schema (colon-URN).

import { readFileSync } from 'node:fs';
import { exit } from 'node:process';
import { createAjv, addCoreSchemas } from '@zkpip/core';

const SCHEMA_ID = 'urn:zkpip:mvs:schemas:proofEnvelope.schema.json';

function validateFile(p: string): boolean {
  const ajv = createAjv();
  addCoreSchemas(ajv);

  const validate =
    ajv.getSchema(SCHEMA_ID) ??
    ajv.compile({ $ref: SCHEMA_ID });

  const raw = readFileSync(p, 'utf8');
  const data: unknown = JSON.parse(raw);

  const ok = validate(data);
  if (!ok) {
    // eslint-disable-next-line no-console
    console.error(`✖ Validation failed for ${p}`);
    // eslint-disable-next-line no-console
    console.error(validate.errors);
  } else {
    // eslint-disable-next-line no-console
    console.log(`✔ ${p} is valid`);
  }
  return !!ok;
}

async function main(): Promise<void> {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error('Usage: tsx ./scripts/validate-proof-envelope.ts <file1.json> [file2.json ...]');
    exit(2);
  }
  let allOk = true;
  for (const f of files) {
    allOk = validateFile(f) && allOk;
  }
  exit(allOk ? 0 : 1);
}

void main();
