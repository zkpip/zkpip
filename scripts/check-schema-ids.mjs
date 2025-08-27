#!/usr/bin/env node
import fs from "fs";
import path from "path";
import process from "process";

// --- Beállítások/Elvárások ---
// Fájlnév → elvárt kanonikus URN
const EXPECTED = {
  "mvs.core.schema.json":         "urn:zkpip:mvs.core.schema.json",
  "mvs.verification.schema.json": "urn:zkpip:mvs.verification.schema.json",
  "mvs.issue.schema.json":        "urn:zkpip:mvs.issue.schema.json",
  "mvs.ecosystem.schema.json":    "urn:zkpip:mvs.ecosystem.schema.json",
  "mvs.proof-bundle.schema.json": "urn:zkpip:mvs.proof-bundle.schema.json",
  "mvs.cir.schema.json":          "urn:zkpip:mvs.cir.schema.json",
};

// Hol keressük a sémákat:
const SCHEMAS_DIR = path.resolve(process.cwd(), "schemas");

// --- Hasznos függvények ---
function readJson(p) {
  const raw = fs.readFileSync(p, "utf8");
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error(`Invalid JSON in ${p}: ${e.message}`);
  }
}

function isDraftUrl(v) {
  return typeof v === "string" && /^https:\/\/json-schema\.org\/draft\//.test(v);
}

// --- Fő logika ---
let hadError = false;

// 1) Bejárjuk az EXPECTED kulcsait és elvégezzük az ellenőrzést
const seenIds = new Map(); // $id → [fájlok]
for (const [filename, expectedId] of Object.entries(EXPECTED)) {
  const abs = path.join(SCHEMAS_DIR, filename);
  if (!fs.existsSync(abs)) {
    console.error(`❌ Missing schema file: ${abs}`);
    hadError = true;
    continue;
  }

  const json = readJson(abs);
  const actualId = json?.$id;
  const actualSchema = json?.$schema;

  // $schema = draft URL ellenőrzés (extra guard)
  if (!isDraftUrl(actualSchema)) {
    console.error(
      `❌ ${filename}: $schema must be a JSON Schema draft URL (e.g. 2020-12). Got: ${String(actualSchema)}`
    );
    hadError = true;
  }

  // $id megléte
  if (typeof actualId !== "string" || !actualId.trim()) {
    console.error(`❌ ${filename}: missing or empty "$id"`);
    hadError = true;
  } else {
    // $id = elvárt URN?
    if (actualId !== expectedId) {
      console.error(
        `❌ ${filename}: $id mismatch\n   expected: ${expectedId}\n   actual:   ${actualId}`
      );
      hadError = true;
    }
    // egyediség gyűjtése
    const arr = seenIds.get(actualId) ?? [];
    arr.push(filename);
    seenIds.set(actualId, arr);
  }
}

// 2) Egyediség ellenőrzése
for (const [id, files] of seenIds.entries()) {
  if (files.length > 1) {
    console.error(`❌ Duplicate $id detected: ${id}\n   files: ${files.join(", ")}`);
    hadError = true;
  }
}

// 3) Visszatérés
if (hadError) {
  console.error("\n❌ Schema $id check FAILED.");
  process.exit(1);
} else {
  console.log("✅ Schema $id check passed.");
}
