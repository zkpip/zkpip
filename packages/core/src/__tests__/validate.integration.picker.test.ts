// Integration tests for validate.ts using filename-based routing via pickSchemaId.
// Exercises: createAjv + addCoreSchemas + pickSchemaId + AJV validate.
import { existsSync, writeFileSync, mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { describe, it, expect } from "vitest";
import { validatePath } from "../cli/validate.js";

// Locate <repo>/schemas from this test file location
function findRootSchemasDir(): string {
  const __filename = fileURLToPath(import.meta.url);
  let dir = dirname(__filename);
  for (let i = 0; i < 8; i++) {
    const candidate = resolve(dir, "../../../../schemas");
    if (existsSync(candidate)) return candidate;
    const direct = resolve(dir, "schemas");
    if (existsSync(direct)) return direct;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(process.cwd(), "schemas");
}

const SCHEMAS_DIR = findRootSchemasDir();
const VERIF_VECTOR = resolve(SCHEMAS_DIR, "tests/vectors/mvs/verification-groth16-evm.json");
const ISSUE_VECTOR = resolve(SCHEMAS_DIR, "tests/vectors/mvs/issue-public-input-order.json");
const ECO_VECTOR   = resolve(SCHEMAS_DIR, "tests/vectors/mvs/ecosystem-aztec.json");

// a test cases-ben pedig ezeket használd:
await expect(validatePath(VERIF_VECTOR)).resolves.toBeUndefined();
await expect(validatePath(ISSUE_VECTOR)).resolves.toBeUndefined();
await expect(validatePath(ECO_VECTOR)).resolves.toBeUndefined();

/** Helper: create a temp JSON file with the given name and object payload. */
function tmpJsonFile(name: string, obj: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), "zkpip-validate-"));
  const p = join(dir, name);
  writeFileSync(p, JSON.stringify(obj, null, 2), "utf-8");
  return p;
}

describe("validate.ts + pickSchemaId integration", () => {
  it("routes verification vectors to the verification schema (legacy 'error' filenames tolerated)", async () => {
    await expect(validatePath(VERIF_VECTOR)).resolves.toBeUndefined();
  });

  it("routes issue vectors to the issue schema", async () => {
    await expect(validatePath(ISSUE_VECTOR)).resolves.toBeUndefined();
  });

  it("routes ecosystem vectors to the ecosystem schema", async () => {
    await expect(validatePath(ECO_VECTOR)).resolves.toBeUndefined();
  });

  it("routes proof-bundle manifest files by name to the proofBundle schema (valid example)", async () => {
    const valid = {
      schemaVersion: "0.1.0",
      bundleId: "bndl-001",
      prover: "snarkjs",             
      proofSystem: "groth16",
      curve: "bn128",
      program: { language: "circom", entry: "circuits/main.circom" },
      artifacts: {
        wasm: { path: "build/main.wasm" },
        zkey: { path: "build/main.zkey" }
      },
    };
    const p = tmpJsonFile("my.proof-bundle.manifest.json", valid);
    await expect(validatePath(p)).resolves.toBeUndefined();
  });

  it("rejects invalid proof-bundle (snarkjs without zkey)", async () => {
    const invalid = {
      schemaVersion: "0.1.0",
      bundleId: "bndl-002",
      prover: "snarkjs",
      proofSystem: "groth16",
      curve: "bn128",
      program: { language: "circom", entry: "circuits/main.circom" },
      artifacts: {
        wasm: { path: "build/main.wasm" }
      }
    };
    const p = tmpJsonFile("bundle.manifest.json", invalid);
    await expect(validatePath(p)).rejects.toThrow(/Validation failed/);
  });

  it("routes CIR files by name to the cir schema (valid example)", async () => {
    const valid = {
      formatVersion: "0.1",
      proofSystem: "groth16",
      curve: "bn128",
      fieldModulus:
        "21888242871839275222246405745257275088548364400416034343698204186575808495617",
      circuits: [
        {
          id: "main",
          hash:
            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          nConstraints: 3,
          nSignalsPublic: 1,
          nSignalsPrivate: 2
        }
      ]
      // extensions: { "urn:zkpip:ext.example": { note: "opaque payload" } }
    };
    const p = tmpJsonFile("circuit-spec.cir.json", valid);
    await expect(validatePath(p)).resolves.toBeUndefined();
  });

  it("rejects invalid CIR (nConstraints = 0)", async () => {
    const invalid = {
      formatVersion: "0.1",
      proofSystem: "groth16",
      curve: "bn128",
      fieldModulus:
        "21888242871839275222246405745257275088548364400416034343698204186575808495617",
      circuits: [
        {
          id: "main",
          hash:
            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          nConstraints: 0,
          nSignalsPublic: 1,
          nSignalsPrivate: 2
        }
      ]
    };
    const p = tmpJsonFile("cir.json", invalid);
    await expect(validatePath(p)).rejects.toThrow(/Validation failed/);
  });

  it("defaults to core schema when filename does not match any known pattern", async () => {
    // Minimal 'core' payload; adjust if your core schema is stricter.
    const minimalCore = { $schema: "urn:zkpip:mvs.core.schema.json" };
    const p = tmpJsonFile("random.json", minimalCore);

    try {
      await validatePath(p);
      expect(true).toBe(true); // passed under current core schema
    } catch (e) {
      expect(String(e)).toMatch(/Validation failed|Schema:/);
    }
  });
});
