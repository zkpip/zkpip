
# ZKPIP — Repo Audit & Action Plan for **MVS v1.0**  
**Date:** 2025-08-31

> Goal: align the repository with the **Roadmap — MVS v1.0** (Groth16/Plonk + ZoKrates + Circom/snarkjs baseline adapters, CLI tooling for validate/verify/seal-light, Light Batch Seal, EF grant‑readiness).

---

## 1) Quick Assessment (what to keep vs. clean)

### Keep (good status)
- **`packages/core`**
  - MVS schemas: `mvs.core`, `mvs.proof-bundle`, `mvs.verification`, `mvs.cir`, `mvs.issue`, `mvs.ecosystem`.
  - AJV bootstrap & utilities (`src/schemaUtils.ts`, `src/validation/*`).
  - Test vectors under `packages/core/schemas/tests/vectors/mvs/*`.
- **Docs**: `docs/zkpip-roadmap-and-spec.md`, `docs/thread-start.md`, `ZKPIPs/*` template.
- **Workflows**: schema validation & core CI skeletons exist and are a good base.

### Clean / Fix (high‑priority)
- **Remove checked‑in coverage**: `packages/core/coverage/**` should be ignored (add `**/coverage/` to `.gitignore`).
- **Monorepo workspaces**: root `package.json` lacks `"workspaces"`. Add `["packages/*"]`.  
  - Replace **Windows path** dep in `@zkpip/cli` (`"@zkpip/core": "file:C:/..."`) with `"workspace:*"`.
- **README accuracy**: references to `rapidsnark`/`gnark` should be postponed or moved to “Future Work”.  
- **STARK scope**: keep neutral mentions in schemas, but mark **STARK adapters out‑of‑scope for MVS v1.0** in docs.
- **Templates/data**: `data/samples/*` can move under `packages/core/schemas/tests/samples/` for consolidation. `templates/` is currently empty—either populate or remove.

---

## 2) Baseline Adapters (4) — design & minimal interface

We will treat **protocol** and **framework** as dimensions:

- **Protocol**: `Groth16`, `Plonk`
- **Framework**: `snarkjs`, `zokrates`
- **Artifacts**: circom/snarkjs JSON vkey/zkey (Circom), ZoKrates `verification.key` + ABI‑compatible verifier (Solidity), proof/publicInputs in proof‑bundle.

**Target set (4 adapters):**
1. `snarkjs-groth16` (Circom artifacts)
2. `snarkjs-plonk` (Circom artifacts)
3. `zokrates-groth16` (ZoKrates artifacts)
4. `circom-snarkjs-groth16` (separate loader variant if artifact shape differs — else fold into #1)

> Note: If #1 and #4 collapse, we still ship **four** by splitting ZoKrates into two loaders (file‑based vs inline JSON) or by adding `plonk-zokrates` if feasible; otherwise document three shipped + one “stubbed but not enabled”.

**Adapter interface (TypeScript skeleton):**
```ts
export interface Adapter {
  id: string; // e.g., "snarkjs-groth16"
  proofSystem: "Groth16" | "Plonk";
  framework: "snarkjs" | "zokrates";
  canHandle(bundle: ProofBundle): boolean;
  verify(bundle: ProofBundle): Promise<VerifyResult>;
}

export interface VerifyResult {
  ok: boolean;
  adapter: string;
  details?: Record<string, unknown>;
  error?: string;
}
```

**Registry & picker:**
```ts
const registry: Adapter[] = [ snarkjsGroth16, snarkjsPlonk, zokratesGroth16 ];
export function pickAdapter(bundle: ProofBundle): Adapter | undefined {
  return registry.find(a => a.canHandle(bundle));
}
```

---

## 3) CLI Scope for MVS v1.0

1) `zkpip validate`  
   - Validate a JSON file (vector or user input) against MVS schema set.

2) `zkpip verify --bundle <path> | --verification <path> [--json] [--exit-codes]`  
   - Pick adapter by `proofSystem/framework` from bundle or verification record and run off‑chain verification.

3) `zkpip seal light --bundle <path> --out <seal.json>`  
   - Produce **Light Seal** JSON with normalized inputs + cryptographic digests. No signatures in OSS mode.

4) `zkpip seal light-batch --dir <folder> --out <batch-seal.json>`  
   - Batch over multiple bundles, include per‑item light seals and an aggregated digest.

**CLI wiring plan:**
- Implement `verify` first using the adapter registry.
- Layer `seal light` on top (calls `verify`, then generates seal JSON).
- Add `vectors validate` (already present) to the default help.

---

## 4) New Schemas to add (Draft)

- `mvs.seal-light.schema.json`  
  Fields: `schemaVersion`, `recordType:"seal_light"`, `bundleId`, `adapter`, `proofSystem`, `framework`, `publicInputsHash`, `proofHash`, `verifierOutcome`, `createdAt`, `toolVersion`.

- `mvs.seal-light-batch.schema.json`  
  Fields: `schemaVersion`, `recordType:"seal_light_batch"`, `items: SealLight[]`, `aggregateHash`, `createdAt`, `toolVersion`.

> Hashing: canonical JSON serialization (UTF‑8) + `sha256`. Keep deterministic key ordering. Document normalization for `publicInputs`.

---

## 5) Repository layout (proposed)

```
packages/
  core/
    src/
    schemas/
  cli/
    src/
  adapters/
    snarkjs-groth16/
    snarkjs-plonk/
    zokrates-groth16/
```

- Each adapter package exports a single `Adapter` instance and minimal helpers.
- `@zkpip/cli` depends on adapters; adapters depend on `@zkpip/core` types.

---

## 6) CI / Release

- **Add**: `cli-ci.yml` (build CLI, run `vectors validate`, smoke‑test `verify` against golden vectors).
- **Schema guard**: keep existing job; extend to assert **$id uniqueness** and **no schema drift**.
- **Publish** (manual, tag‑driven): semantic versions for `@zkpip/core`, `@zkpip/cli`, and adapters; npm provenance.
- **.gitignore**: add `**/coverage/` and `packages/**/dist/` (already present for root, extend to packages).

---

## 7) Documentation updates

- **README (root)**: reflect **current** adapter set; move `rapidsnark/gnark` to “Future Work”.
- **Docs**: add a short “Adapter Matrix” and a “Light Seal” explainer with JSON examples.
- **CONFORMANCE.md**: define what “MVS‑conformant” means for tools and vectors.
- **MIGRATION.md**: note that STARK adapters are **out of scope** for MVS v1.0.

---

## 8) Ethereum Foundation (grant) readiness — checklist

- ✅ OSS license (MIT) at repo root.
- ✅ Clear **scope & milestones** (Roadmap + this action plan).
- ✅ Reproducible build (npm workspaces, lockfiles, CI instructions).
- ✅ Test vectors + CI.
- ✅ Documentation (usage, schemas, examples).
- ⏳ **Deliverables mapping** with dates (**add** to README/docs).
- ⏳ Minimal website/docs page (can be GitHub Pages or S3/CloudFront) describing MVS v1.0 and how to try it.

---

## 9) Immediate PR plan (suggested sequence)

1. **PR-001 — Monorepo hygiene**
   - Add `workspaces` to root, fix `@zkpip/cli` dep (`"workspace:*"`), extend `.gitignore`, remove committed `packages/core/coverage/**`.
2. **PR-002 — Docs refresh**
   - Update root README and roadmap references; mark STARK “out of scope” for MVS v1.0.
3. **PR-003 — CLI verify (MVP)**
   - Implement adapter registry + `verify` wiring (with stub adapters returning `ok:false` + “not implemented” until implemented).
4. **PR-004 — Adapters v0**
   - Implement `snarkjs-groth16` and `snarkjs-plonk` minimally (load vkey/proof/publicInputs, run `snarkjs` verify).
5. **PR-005 — ZoKrates v0**
   - Implement `zokrates-groth16` (parse `verification.key` + proof, verify via ZoKrates tooling or equivalent lib). 
6. **PR-006 — Seal Light (+ Batch)**
   - Add schemas, implement `seal light` and `seal light-batch`, add golden examples.
7. **PR-007 — CI hardening & Release prep**
   - CLI smoke tests, schema conformance, version bump, tag‑release pipeline.

---

## 10) Snippets to apply

**Root `package.json` (add workspaces):**
```json
{
  "name": "zkpip",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "build": "npm -w @zkpip/core run build && npm -w @zkpip/cli run build"
  }
}
```

**`packages/cli/package.json` (fix dependency):**
```json
{
  "dependencies": {
    "@zkpip/core": "workspace:*",
    "yargs": "^17.7.2",
    "commander": "^14.0.0"
  }
}
```

**`.gitignore` additions:**
```
**/coverage/
packages/**/dist/
```

---

## 11) Open Questions / Notes
- If we want exactly **four** adapters in v1.0, we can either:
  - Split `snarkjs-groth16` into **circom** vs **generic JSON** loaders, or
  - Add `plonk` for ZoKrates (if feasible), or
  - Introduce a minimal `groth16-evm` generic adapter using standard vkey/proof shapes.
- Confirm artifact normalization rules for **public inputs** (ordering, hex/dec, 0x prefix). These will affect seal hashing.

---

### ✅ Outcome
This plan keeps the repo lean, focuses on **Groth16/Plonk + (snarkjs, ZoKrates)**, wires the **CLI verify → seal-light**, and prepares the project for **EF grant** submission.
