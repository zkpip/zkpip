// packages/core/src/validation/ajv.ts
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type Schema } from "ajv";
import Ajv2020 from "ajv/dist/2020.js"; 
import addFormats from "ajv-formats";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const PKG_ROOT   = path.resolve(__dirname, "..", "..");

function schemasRoot(): string {
  const fromEnv = process.env.ZKPIP_SCHEMAS_ROOT;
  if (fromEnv) return path.isAbsolute(fromEnv) ? fromEnv : path.resolve(process.cwd(), fromEnv);

  const dist = path.join(PKG_ROOT, "dist", "schemas");
  const dev  = path.join(PKG_ROOT, "schemas");
  return fs.existsSync(dist) ? dist : dev;
}

function isFile(p: string) { try { return fs.statSync(p).isFile(); } catch { return false; } }
function list(dir: string) { try { return fs.readdirSync(dir); } catch { return []; } }

/** Elsődlegesen dot-nevek, de támogatjuk a régi "mappa/fájl" formátumot is. */
function resolveSchemaPath(relPath: string): string {
  const root = schemasRoot();
  const base = path.basename(relPath);

  const dotified = relPath.includes("/") ? relPath.replace(/\//g, ".") : relPath;

  const candidates = [
    path.resolve(root, relPath),      // ha már eleve dot-os, ez jó lesz
    path.resolve(root, dotified),     // fallback: mvs/proof-bundle → mvs.proof-bundle
    path.resolve(root, base),         // fallback: csak a fájlnév
  ];

  for (const c of candidates) {
    if (isFile(c)) return c;
  }

  throw new Error(
    `Schema path resolution failed for "${relPath}". Debug: ` +
    JSON.stringify({ root, candidates, rootListing: list(root) }, null, 2)
  );
}

export function loadSchemaJson<T = Schema>(relPath: string): T {
  const abs = resolveSchemaPath(relPath);
  const raw = fs.readFileSync(abs, "utf8");
  return JSON.parse(raw) as T;
}

export function createAjv(): Ajv2020 {
  const ajv = new Ajv2020({
    allErrors: true,
    strict: false,
    allowUnionTypes: true,
  });
  addFormats(ajv);
  return ajv;
}
