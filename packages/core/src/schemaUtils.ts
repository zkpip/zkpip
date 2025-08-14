// packages/core/src/schemaUtils.ts
import fs from "fs";
import path from "path";

export const CANONICAL_IDS: Record<string, string> = {
  "mvs.core.schema.json": "https://zkpip.org/schemas/mvs.core.schema.json",
  "mvs.ecosystem.schema.json": "https://zkpip.org/schemas/mvs.ecosystem.schema.json",
  "mvs.issue.schema.json": "https://zkpip.org/schemas/mvs.issue.schema.json",
  "mvs.verification.schema.json": "https://zkpip.org/schemas/mvs.verification.schema.json",
};

// 💡 Típus az AJV példányra (stabil a NodeNext + verbatim mellett is)
type Ajv = import("ajv").default;

// 💡 Konstruktor fallback: először próbál ESM (ajv/dist/2020), majd ajv default, végül CJS
const AjvCtor: new (opts?: any) => Ajv = (() => {
  try {
    // ESM 2020-12 build (ha elérhető a típussal)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("ajv/dist/2020").default;
  } catch {
    try {
      // Normál default export
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require("ajv");
      return (mod.default ?? mod) as new (opts?: any) => Ajv;
    } catch (e) {
      throw new Error(
        "Failed to load AJV constructor. Ensure `ajv@^8` is installed in packages/core."
      );
    }
  }
})();

// 🔹 addFormats fallback loader (ESM/CJS kompatibilis)
type AddFormats = (ajv: Ajv) => void;
const addFormats: AddFormats = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require("ajv-formats");
    return (mod.default ?? mod) as AddFormats;
  } catch {
    throw new Error("Failed to load ajv-formats. Ensure `ajv-formats@^3` is installed in packages/core.");
  }
})();

export function createAjv(): Ajv {
  const ajv = new AjvCtor({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv;
}

export function repoRoot(): string {
  return path.resolve(process.cwd(), "../../");
}

export function readJson(absPath: string): any {
  const raw = fs.readFileSync(absPath, "utf8");
  return JSON.parse(raw);
}

export function schemasDir(): string {
  return path.join(repoRoot(), "schemas");
}

export function vectorsDir(): string {
  return path.join(schemasDir(), "tests", "vectors", "mvs");
}

export function addCoreSchemas(ajv: Ajv, baseDir: string = schemasDir()): void {
   const coreOrder = [
     "mvs.core.schema.json",
     "mvs.ecosystem.schema.json",
     "mvs.issue.schema.json",
     "mvs.verification.schema.json",
   ];
   for (const name of coreOrder) {
     const p = path.join(baseDir, name);
     if (!fs.existsSync(p)) {
       throw new Error(`Missing core schema: ${p}`);
     }
     const schema = readJson(p);
     const id = CANONICAL_IDS[name];
     schema.$id = id;
     ajv.addSchema(schema, id);
   }
 }

export function validateAgainst(ajv: Ajv, refId: string, data: any): { ok: boolean; errors?: string } {
  try {
    const validate = ajv.getSchema(refId) || ajv.compile({ $ref: refId });
    const ok = !!validate(data);
    return ok ? { ok } : { ok, errors: ajv.errorsText(validate.errors, { separator: "\n" }) };
  } catch (e: any) {
    return { ok: false, errors: String(e?.stack || e) };
  }
}
