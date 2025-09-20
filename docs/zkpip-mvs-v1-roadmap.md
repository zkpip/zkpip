# ZKPIP MVS v1 Roadmap

> **Scope:** OSS-first, free single-proof validation with three basic adapters; no monetization in v1.  
> **Licensing:** Apache-2.0 (code), CC BY 4.0 (docs), ToS for CanVectors.  
> **Trademarks:** ZKPIP™, ProofEnvelope™, ProofEnvelope™, SealScan™, CanVectors™.

---

## 0) Objectives (MVS v1)

- **Core refactor:** Stable **ProofEnvelope / ProofEnvelope** as foundation.  
- **Adapters:** 3 basic adapters (snarkjs-plonk, snarkjs-groth16, zokrates-groth16).  
  _(Optional in v1: Circom compatibility via extractor/normalizer → feeding snarkjs inputs.)_  
- **ProofBridge demo:** one free converter (e.g. snarkjs <-> zokrates), CPU-only, single proof, to demonstrate ProofEnvelope interoperability.  
- **Validation:** CLI validates single proofs (unlimited number, but only one at a time).  
- **Distribution:** `@zkpip/cli` on npm; GitHub Actions workflow.  
- **SealScan:** minimal explorer, showing anonymous per-proof Seals (no accounts, no monetization).  

---

## 1) Specifications (freeze for v1)

- **ProofEnvelope schema** + **Adapter Contract** (I/O, error taxonomy, exit codes).  
- **JSON Schema validation** for CLI inputs and manifests.  
- **Normalization rules** (e.g. stable BigInt/string handling).  
- **Versioning:** semantic versioning; v1 freeze prior to GA.  

---

## 2) Adapters & ProofBridge (CPU-only, Ethereum-centric)

- **snarkjs-plonk**  
- **snarkjs-groth16**  
- **zokrates-groth16**  
- _(Optional: Circom extractor/normalizer feeding into snarkjs)_  
- **ProofBridge demo:** snarkjs <-> zokrates converter, single proof, CPU-only  

**Acceptance:**  
- Valid vectors → `ok:true` / exit 0.  
- Invalid proofs → `verification_failed` / exit 1.  
- Missing fields → `adapter_error`.  

---

## 3) SealScan (MVS v1)

- Anonymous Seal pages only (no Display Plan, no branding).  
- Each single-proof validation produces a SealScan link.  
- Client-side verification of Seal signatures.  

---

## 4) Deliverables (MVS v1 GA)

- **Core schemas:** ProofEnvelope v1, Adapter Contract v1.  
- **CLI:** single-proof validation, schema validation, stable JSON + exit codes.  
- **Adapters:** snarkjs-plonk, snarkjs-groth16, zokrates-groth16 (+ optional Circom extractor).  
- **ProofBridge demo:** snarkjs <-> zokrates converter.  
- **CanVectors:** minimal signed test vectors (valid + invalid).  
- **SealScan (minimal):** static per-Seal pages, anonymous only.  
- **Docs:** quickstart, schema guide, CI workflow.  

---

## 5) Out of scope (MVS v1 → later)

- Additional ProofBridge converters (snarkjs <-> solidity, others)  
- **BatchSeal** (batch validation, colored grouped Seals).  
- **Display Plan** (branding user/org on SealScan).  
- **CodeSeal** (software validation).  
- **Accounts, billing, monetization, enterprise features).  

---

## 6) Milestones

- **M1:** ProofEnvelope/ProofEnvelope refactor + schema freeze.  
- **M2:** 3 adapters passing conformance (maybe +Circom?).  
- **M3:** ProofBridge demo (snarkjs <-> zokrates).  
- **M4:** CLI single-proof validation (schema + exit codes).  
- **M5:** Minimal SealScan with per-Seal pages. (SwiftSeal, BridgeSeal)  
- **M6:** Docs + CI workflows; GA release.  
