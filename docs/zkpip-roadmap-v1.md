# ZKPIP v1 Roadmap (Updated, Server-backed SwiftSeal)

> **Scope:** Ethereum-focused, CPU-only verification; open-spec + signed canonical vectors; server-signed seals with QR + public scan pages.  
> **Licensing:** Code under **Apache-2.0**; CanVectors-related docs under **CC BY 4.0**; test vectors under CanVectors ToS.  
> **Trademarks:** ZKPIP™, CanVectors™ (Canonical ZK Test Vectors), VectorForge™, SwiftSeal™, SealScan™.

---

## 0) Objectives (v1)

- **Credibility:** Deterministic, signed **CanVectors™** + CLI that verifies both **signatures** and **hashes**.
- **Coverage:** CPU-only adapters for Ethereum devs: **snarkjs-plonk**, **snarkjs-groth16**, **zokrates-groth16**.  
  _(Circom compatibility via artifacts extractor → normalized inputs into snarkjs adapters; no separate Circom adapter in v1.)_
- **Distribution & DX:** `@zkpip/cli` (npm), **GitHub Actions** templates, one-command quickstart.
- **Proof trust anchor:** **SwiftSeal™ v1-server** issues **server-signed seals** for up to **10 proofs** per request; **SealScan™** hosts public detail pages and badge QR links.
- **Interoperability demonstration:** first **ProofEnvelope** cross-system test via a **snarkjs-groth16 two-way converter**, showing schema-level portability.

---

## 1) Specifications (freeze for v1)

- **ProofEnvelope** schema + **Adapter Contract** (inputs/outputs, error taxonomy, exit codes).
- **JSON Schema** validation for CLI inputs and manifests.
- **Normalization rules** (e.g., public signals must be strings; stable BigInt/string handling).
- **Versioning:** Semantic versioning; “v1” freeze prior to GA.

**Acceptance:**

- All three adapters pass conformance tests.
- CLI returns stable JSON + exit codes.
- Schema violations return `schema_invalid` with clear paths.
- **Converter acceptance:** snarkjs-groth16 proofs can be normalized in/out of ProofEnvelope without loss of information.

---

## 2) CanVectors™ (Canonical ZK Test Vectors)

_(no change)_

---

## 3) Adapters (CPU-only, Ethereum-centric)

- **snarkjs-plonk** (BN254)
- **snarkjs-groth16** (BN254) + **converter demo (ProofEnvelope ↔ native JSON)**
- **zokrates-groth16** (BN254)
- **Circom compatibility:** artifacts **extractor/normalizer** (vk/proof/publics → snarkjs adapter inputs).
- **Out-of-scope v1:** zkEVM, Halo2/KZG, Plonky2, Risc0 (v1.1+).

**Acceptance:**

- Valid vectors → `ok:true` / exit 0.
- Tampered publics/proofs/vk → `verification_failed` / exit 1.
- Missing fields → `adapter_error`.
- **Converter demo**: round-trip serialization to/from ProofEnvelope yields identical verification outcome.

---

## 4) SwiftSeal™ v1-server (server-signed seals + public scan)

_(no change)_

---

## 5) Developer Experience & Distribution

_(no change)_

---

## 6) Deliverables (v1 GA)

- **Specs:** ProofEnvelope v1, Adapter Contract v1, Manifest v1.
- **CLI:** verify + vectors fetch/cache + seal request; stable JSON + exit codes; schema validation.
- **Adapters:** snarkjs-plonk, snarkjs-groth16 (+ converter demo), zokrates-groth16 + Circom extractor.
- **CanVectors:** signed manifests, minimal canonical suites (valid + ≥3 invalid per adapter), hosted via **VectorForge™**.
- **SwiftSeal v1-server:** APIs, server-signed seals, badges with QR, **SealScan** public pages, JWKS keyring.
- **CI templates:** GitHub Actions workflow + status badge instructions.
- **Docs:** Roadmap, SCHEMA-GUIDE, CI-WORKFLOWS, TRADEMARKS, COPYRIGHT, ToS (vectors).

---

## 7) Out of Scope (v1 → v1.1+)

_(unchanged — converter roadmap continues beyond v1)_

---

## 8) Risks & Mitigations

_(no change)_

---

## 9) Milestones (suggested)

- **M1 (Spec & Vectors):** Spec freeze; minimal CanVectors signed sets; CLI fetch/cache.
- **M2 (Adapters & CLI):** 3 adapters conformance green; Circom extractor; error taxonomy stable.
- **M2.1 (Interop demo):** snarkjs-groth16 ↔ ProofEnvelope converter validated with round-trip test vectors.
- **M3 (SwiftSeal v1-server):** POST/GET APIs; KMS signing; SealScan per-Seal pages; badge + QR.
- **M4 (DX/CI & GA):** GitHub Action + docs; sample repos live; v1 GA tag.

---
