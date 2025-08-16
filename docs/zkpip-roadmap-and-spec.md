# ZKPIP — Roadmap, Proof-Bundle & CIR Spec, Adapter SDK & Registry (v0.1)
Date: 2025-08-16  
Owner: Tony Nagy (ZKPIP founder- @tonynagyeurope)  
Status: Draft (repo-ready)

**Scope:** This document consolidates the current roadmap, Proof-Bundle & CIR v0.1 specification outline, the multi-verify CLI plan, the Adapter SDK & Registry design, governance/KPIs, risks, and a recalibrated schedule. It is intended for inclusion in the repository (e.g., `docs/zkpip-roadmap-and-spec.md`).

---

## 0) Executive Summary
ZKPIP aims to become a vendor-neutral standard and reference implementation for **multi-verify off-chain verification** across ZK stacks. We define a **Proof-Bundle** file format (with a **Canonical Intermediate Representation — CIR**), a **unified CLI**, and a **plugin adapter** model (in-process TS/JS and out-of-process JSON-RPC). The goal is practical interoperability, determinism, and excellent DX, enabling reproducible verification across ecosystems without hard lock-ins.

**North Star:** Reduce *Mean Time To Diagnose (MTTD)* for ZK issues to **< 5 minutes** from submission to reproducible steps.

---

## 1) Vision & Goals
- **Interoperability by design:** Proof-Bundle + CIR as the “thin waist” between diverse frontends/backends.
- **Deterministic pipelines:** schema-guarded manifests, checksums, version pinning.
- **Great DX:** one-command `verify`, clear error codes, quickstarts, golden vectors.
- **Ecosystem growth:** optional adapters for zkInterface and major stacks; community-maintained Registry.

**Key 2025 metrics (post-beta):**  
Coverage ≥ 1,500 normalized records / ≥ 12 ecosystems; macro-F1 ≥ 0.85 on labeled set; CI < 10 min; 25+ external submissions.

---

## 2) Repository Map (proposed)
/docs/ # This document + quickstarts + capability matrix
/spec/ # JSON Schemas, CIR rules, RFCs
/cli/ # zkpip CLI
/adapters/ # Official adapters (e.g., adapter-snarkjs)
/registry/ # Public Adapter Registry (JSON index)
/golden-vectors/ # Canonical test bundles (positive/negative)
/examples/ # Sample bundles, import/export examples

Licenses: Spec text CC BY 4.0; code and JSON schemas Apache-2.0/MIT (SPDX headers).

---

## 3) Proof-Bundle & CIR — v0.1 (Specification Outline)
**3.1 Bundle container:** deterministic ZIP (or tar). Root contains `manifest.json` and artefacts.  
**3.2 Manifest (JSON, SemVer, schema-guarded):**
- `schema_version` (SemVer), `cir_version`
- `scheme` (`groth16|plonk|halo2|stark|…`), `curve` (`bn254|bls12-381|pallas|vesta|…`)
- `field_modulus` (hex), `encoding` (`{ format: hex|dec, endianness: be|le }`)
- `public_inputs`: `string[]` (canonical big-endian 0x-hex)
- `artifacts[]`:
  - `role`: `proof|vk|public_inputs|circuit_meta|r1cs|wasm|srs|…`
  - `path`, `bytes`, `sha256`
- `backend_hint`: `{ name, version }`
- `provenance`, `licenses`, `ext` (forward-compat reserved space)

**3.3 CIR rules:**
- Mandatory invariants: modulus check, curve/scheme consistency, explicit endianness.
- Coordinates/field elements: BE 0x-hex, length checks, no ambiguous encodings.
- Error codes (non-exhaustive):  
  `vk_mismatch`, `curve_mismatch`, `field_overflow`, `encoding_error`,  
  `proof_verification_failed`, `unsupported_scheme`, `backend_runtime_error`.

**3.4 Conformance:** JSON Schema validation + golden vectors (positive/negative, VK mismatch, endianness error, tampered checksum).

---

## 4) Multi-Verify CLI (MVP)
**Commands:**
- `zkpip bundle validate <bundle.zip>`  
- `zkpip verify <bundle.zip> [--adapter snarkjs] [--json]`  
- `zkpip import --from zkinterface --in proof.json --out bundle.zip` *(optional adapter)*  
- `zkpip export --to zkinterface --in bundle.zip --out proof.json` *(optional adapter)*

**Outputs:** machine-readable JSON (`VerifyResult { ok, reason?, metrics{time,mem}, versions, transcript? }`) and human summary.

**Exit codes:** `0` success; non-zero per error code class (documented mapping).

---

## 5) Adapter Model
### 5.1 In-process Adapter SDK (TypeScript)
```ts
export interface VerifierAdapter {
  id: string;                             // e.g., "snarkjs"
  getCapabilities(): Capability[];        // scheme × curve × format
  canImport(input: unknown): boolean;
  importToCIR(input: unknown): CIRBundle; // normalization
  verify(bundle: CIRBundle): Promise<VerifyResult>;
}

```

Package convention: @zkpip/adapter-<name>.

Discovery: zkpip adapter list (npm dependency tree).

Config: .zkpiprc.json (allowlist, priority, sandbox).

### 5.2 Out-of-process Adapter (JSON-RPC over stdio)

Language-agnostic; executed with no network, CPU/memory limit, timeouts.

Required RPC: getCapabilities, importToCIR, verify.

Usage: zkpip verify bundle.zip --adapter exec:/path/to/adapter.

### 5.3 Security & Determinism

No shell-exec chains; deterministic WASM; isolated temp I/O.

Reproducibility: adapter version pin; VerifyResult includes time/mem and versions.

## 6) Adapter Registry (Community)

Separate repo with a signed JSON index.

Submit via PR with automatic checks:

adapter.manifest.json (name, version, maintainer, license, repo URL)

Declared capabilities + minimal benchmark (time/mem range)

Permissive license (Apache-2.0/MIT/BSD, SPDX)

Security guarantees (no-network, deterministic)

Conformance green on required golden vectors (public CI badge)

Documentation (install/usage/limits)

Capability Matrix auto-generated in CI (diff-guard).

Optional Trusted badge (manual review/audit).

## 7) Interop Strategy (zkInterface et al.)

No hard dependency in core.

Optional @zkpip/adapter-zkinterface for import/export.

Quickstarts: “Verify without zkInterface” and “Interop with zkInterface”.

## 8) Developer Experience

zkpip adapter init <name> → scaffold (types, tests, CI).

zkpip adapter test → local harness running golden vectors.

Helpful errors: suggest installing relevant adapters or using import/export.

## 9) Governance, Versioning, Licensing

SemVer for Schemas, CLI, Adapter API.

Deprecation policy: 1 release cycle grace period + CLI warnings.

Licensing: Code & schemas Apache-2.0/MIT; Spec text CC BY 4.0; SPDX tags.

Security policy: SECURITY.md with coordinated disclosure; fast registry revocation.

## 10) KPIs & Quality

Unknown rate on smoke set; macro-F1 on labeled set (≥200 items).

CI green main; coverage ≥80% core; runtime ≤10 min.

Conformance pass rate on golden vectors (100%).

Community signals: external PRs, adapter submissions, bundle downloads.

## 11) Risks & Mitigations

Encoding drift: strict schema validation + invariants + golden vectors.

Transitive deps: adapters isolated; core has no cryptographic hard deps.

Performance anomalies: measure in VerifyResult.metrics; regression tests.

“Yet another format” concerns: import/export, thin-waist value, reference impl.

## 12) Recalibrated Schedule (Realistic)

Based on two weeks of intensive work and the schema refactor, full scope is longer than one quarter. Proposed horizon: 4–6 months (baseline ≈ 5 months), assuming ~30–40 h/week.

Phases & Milestones

F1 (Weeks 0–6): Proof-Bundle & CIR v0.1, CLI (validate/verify), adapter-snarkjs, 10 golden vectors, Capability Matrix v1.

F2 (Weeks 6–12): zkInterface import/export; second adapter (e.g., gnark/Plonk); ecosystem crawler v1; submission CLI.

F3 (Weeks 12–18): Off-chain verify extensions; badges v1; portal/SSG docs; metrics dashboards.

F4 (Weeks 18–24): Public Beta hardening; conformance suite expansion; Adapter Registry opening; first integration case studies.

Critical path: CIR/manifest stability → adapter-snarkjs → golden vectors → CLI contract → 2nd adapter.

## 13) Definition of Done (selected workstreams)

Spec v0.1: Published JSON Schemas, examples, invariants list; migration guidance.

CLI MVP: Deterministic outputs, JSON mode, documented exit codes, telemetry off by default.

Adapter SDK: Stable TS interfaces; exhaustive type docs; examples; tests.

Registry: CI checks; signed index; docs for submitters; capability matrix auto-gen.

Conformance: 10 golden vectors; all official adapters pass; nightly run badge.

## 14) Quickstarts

Verify a bundle: zkpip bundle validate bundle.zip && zkpip verify bundle.zip --json

Import from zkInterface: zkpip import --from zkinterface --in proof.json --out bundle.zip

Write an adapter (TS): zkpip adapter init my-adapter && npm test

## 15) Open Questions / Decision Backlog

Preferred second adapter target (gnark/Plonk vs Halo2).

Bundle container (zip vs tar) — default zip with reproducible flags.

Default curves/schemes in Capability Matrix v1.

Registry signing mechanism and key rotation policy.

## 16) Appendix — Minimal Schemas (sketches)

// manifest.schema.json (excerpt)
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "ZKPIP Proof-Bundle Manifest",
  "type": "object",
  "required": ["schema_version", "cir_version", "scheme", "curve", "encoding", "artifacts"],
  "properties": {
    "schema_version": {"type":"string"},
    "cir_version": {"type":"string"},
    "scheme": {"enum":["groth16","plonk","halo2","stark"]},
    "curve": {"enum":["bn254","bls12-381","pallas","vesta"]},
    "field_modulus": {"type":"string", "pattern":"^0x[0-9a-fA-F]+$"},
    "encoding": {
      "type":"object",
      "required":["format","endianness"],
      "properties": {
        "format":{"enum":["hex","dec"]},
        "endianness":{"enum":["be","le"]}
      }
    },
    "public_inputs": {
      "type":"array",
      "items":{"type":"string","pattern":"^0x[0-9a-fA-F]+$"}
    },
    "artifacts": {
      "type":"array",
      "items": {
        "type":"object",
        "required":["role","path","bytes","sha256"],
        "properties": {
          "role":{"enum":["proof","vk","public_inputs","circuit_meta","r1cs","wasm","srs"]},
          "path":{"type":"string"},
          "bytes":{"type":"integer","minimum":1},
          "sha256":{"type":"string","pattern":"^[0-9a-fA-F]{64}$"}
        }
      }
    },
    "backend_hint": {"type":"object"},
    "provenance": {"type":"object"},
    "licenses": {"type":"object"},
    "ext": {"type":"object"}
  }
}
