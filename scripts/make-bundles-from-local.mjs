#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const args = process.argv;
const dir = args[args.indexOf("--dir")+1];
const out = args[args.indexOf("--out")+1];
if (!dir || !out) {
  console.error("Usage: node scripts/make-bundles-from-local.mjs --dir <artefacts_dir> --out <out_dir>");
  process.exit(2);
}

const read = p => JSON.parse(fs.readFileSync(p, "utf8"));
const proof = read(path.join(dir, "proof.json"));
const pubRaw = read(path.join(dir, "public.json"));
const vkey  = read(path.join(dir, "verification_key.json"));
const publicSignals = Array.isArray(pubRaw) ? pubRaw : (pubRaw.publicSignals ?? pubRaw);

// snarkjs verzió a gyökér package.json-ból
let snarkjsVersion = "0.7.5";
try {
  const pkg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "package.json"), "utf8"));
  snarkjsVersion = (pkg.devDependencies?.snarkjs || pkg.dependencies?.snarkjs || snarkjsVersion).replace(/^[\^~]/, "");
} catch {}

const base = {
  $schema: "urn:zkpip:mvs:schemas:proofBundle.schema.json",
  $id: "urn:zkpip:mvs:vectors:verification:groth16:proof-bundle.valid.json",
  mvs: { kind: "proofBundle", version: "1.0.0" },
  schemaVersion: "1.0.0",
  bundleId: crypto.randomUUID(),
  proofSystem: "groth16",
  curve: "bn128",
  prover: { name: "snarkjs", version: snarkjsVersion },
  program: { name: "circuit", lang: "circom" },
  artifacts: { verificationKey: vkey, proof, publicSignals }
};

fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, "proof-bundle.valid.json"), JSON.stringify(base, null, 2));

const invalid = JSON.parse(JSON.stringify(base));
if (Array.isArray(invalid.artifacts.publicSignals) && invalid.artifacts.publicSignals.length) {
  invalid.artifacts.publicSignals[0] = String(invalid.artifacts.publicSignals[0]) + "_X";
}
invalid.$id = invalid.$id.replace("valid", "invalid");
fs.writeFileSync(path.join(out, "proof-bundle.invalid.json"), JSON.stringify(invalid, null, 2));

console.log("Wrote:", path.join(out, "proof-bundle.valid.json"));
console.log("Wrote:", path.join(out, "proof-bundle.invalid.json"));
