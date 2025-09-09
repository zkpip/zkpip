import { describe, it, expect, beforeAll } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import os from "node:os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// The built CLI
const CLI = path.resolve(__dirname, "..", "dist", "index.js");

// Use proofBundle vectors (SnarkJS Groth16 canonical shape)
const VALID = path.resolve(
  __dirname,
  "../../../core/schemas/tests/vectors/mvs/verification/proofBundle/proof-bundle.valid.json"
);
const INVALID = path.resolve(
  __dirname,
  "../../../core/schemas/tests/vectors/mvs/verification/proofBundle/proof-bundle.invalid.json"
);

// Helper for CLI
function run(args: string[]) {
  return spawnSync(process.execPath, [CLI, ...args], {
    encoding: "utf8",
  });
}

describe("verify --exit-codes E2E", () => {
  let schemaInvalidPath: string;

  beforeAll(() => {
    // Temporary, schema-invalid input (missing required fields)
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "zkpip-cli-"));
    schemaInvalidPath = path.join(tmpDir, "schema-invalid.json");
    fs.writeFileSync(
      schemaInvalidPath,
      JSON.stringify(
        {
          // Looks like 'verification' but intentionally fails schema
          proofSystem: "groth16",
          framework: "snarkjs",
          bundle: {
            proof: {},
            publicSignals: [],
          },
        },
        null,
        2
      ),
      "utf8"
    );
  });

  it("0 → valid bundle (verify success)", () => {
    const r = run([
      "verify",
      "--verification",
      VALID,
      "--adapter",
      "snarkjs-groth16", // force adapter for stability
      "--exit-codes",
      "--json",
    ]);
    if (r.status !== 0) {
      // Helpful debug when this fails in CI
      // eslint-disable-next-line no-console
      console.error("STDOUT:", r.stdout);
      // eslint-disable-next-line no-console
      console.error("STDERR:", r.stderr);
    }
    expect(r.status).toBe(0);
    const out = JSON.parse(r.stdout || "{}");
    expect(out.ok).toBe(true);
    expect(typeof out.adapter).toBe("string");
  });

  it("1 → verification failed (invalid bundle content)", () => {
    const r = run([
      "verify",
      "--verification",
      INVALID,
      "--adapter",
      "snarkjs-groth16", // force adapter for stability
      "--exit-codes",
      "--json",
    ]);
    expect(r.status).toBe(1);
    const err = JSON.parse(r.stderr || "{}");
    expect(err.ok).toBe(false);
    expect(err.stage).toBe("verify");
  });

  it("2 → adapter not found (forced bad adapter)", () => {
    const r = run([
      "verify",
      "--verification",
      VALID,
      "--adapter",
      "does-not-exist",
      "--exit-codes",
      "--json",
    ]);
    expect(r.status).toBe(2);
    const err = JSON.parse(r.stderr || "{}");
    expect(err.ok).toBe(false);
    expect(err.stage).toBe("adapter");
  });

  it("3 → schema invalid (fails MVS schema validation)", () => {
    const r = run([
      "verify",
      "--verification",
      schemaInvalidPath,
      "--exit-codes",
      "--json",
    ]);
    expect(r.status).toBe(3);
    const err = JSON.parse(r.stderr || "{}");
    expect(err.ok).toBe(false);
    expect(err.stage).toBe("schema");
    expect(Array.isArray(err.errors)).toBe(true);
  });

  it("4 → I/O error (ENOENT)", () => {
    const missingPath = path.resolve(__dirname, "definitely-does-not-exist.json");
    const r = run(["verify", "--verification", missingPath, "--exit-codes", "--json"]);
    expect(r.status).toBe(4);
    const err = JSON.parse(r.stderr || "{}");
    expect(err.ok).toBe(false);
    expect(err.stage).toBe("io");
  });
});
