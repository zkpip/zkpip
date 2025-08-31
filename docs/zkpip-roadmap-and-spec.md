# ZKPIP Roadmap — MVS v1.0

> **Executive Summary:** ZKPIP MVS v1.0 delivers a stable foundation for ZK proof-bundle validation with four baseline adapters, a CLI toolchain, and the first Light Seal (single and batch) — providing an OSS-ready and grant-ready product for Ethereum developers.

**Date:** 2025-08-16  
**Status:** Updated planning for MVS v1.0 release

---

## 1. Scope & Vision

The Minimum Viable Standard (MVS v1.0) aims to deliver a stable foundation for ZK proof-bundle validation and developer adoption.  
It includes baseline adapters, a CLI toolchain, and the first implementation of the **Light Seal** for verified proof batches.  
The focus is on simplicity, Ethereum relevance, and adoption readiness.

---

## 2. MVS v1.0 Deliverables

- **Core Schemas (v1.0):**
  - ZK Proof-Bundle & CIR JSON Schema definitions
  - Invariants, canonical fields, validation suite

- **CLI Tooling:**
  - `zkpip validate` — schema validation for ZK proof-bundles and CIR
  - `zkpip verify` — off-chain verification with adapters
  - `zkpip seal light` — issue Light Seal artefacts (JSON + badge)

- **Baseline Adapters (CPU-only):**
  - Groth16 (snarkjs)
  - Plonk (snarkjs)
  - ZoKrates Groth16
  - Circom/snarkjs

- **Light Seal (OSS mode):**
  - Schema v1.0 (metadata, Merkle root, issuer signature)
  - CLI support for Seal generation & verification
  - Artefacts: `seal.json`, badge (SVG), optional report (HTML/PDF)
  - OSS signature mode (developer key); SaaS integration deferred

- **Light Batch Seal (OSS mode):**
  - Support for small proof batches (e.g. up to 50 proofs)
  - Merkle root aggregation over batch proof-bundles
  - CLI support: `zkpip seal light --batch <dir>`
  - Artefacts: `batch_seal.json`, badge (SVG), optional report
  - Cost-efficient (CPU-only, no GPU), aligned with Light Infra SaaS

- **Golden Test Vectors:**
  - Valid/invalid bundles per adapter
  - Error catalog references for common failure cases

- **Documentation:**
  - Quickstart guide
  - Adapter integration examples
  - Light Seal usage & verification

---

## 3. Timeline (12–18 weeks)

- **Week 0–6:**
  - Core schemas v1.0 finalized
  - CLI MVP (validate, verify)
  - First adapter (snarkjs Groth16)
  - Initial golden vectors

- **Week 6–12:**
  - Plonk (snarkjs) adapter
  - ZoKrates Groth16 adapter
  - Circom/snarkjs adapter
  - Extended golden vectors

- **Week 12–16:**
  - Light Seal schema + CLI implementation
  - Badge + artefact generation
  - Documentation for Seal usage
  - Release candidate testing

- **Week 16–18:**
  - Light Batch Seal schema + CLI implementation
  - Merkle root aggregation for batch proof-bundles
  - CLI support for batch sealing (`zkpip seal light --batch <dir>`)
  - Documentation and extended test vectors  

- **OSS-ready + grant-ready product**

- **Milestone:** **MVS v1.0 Release**

---

## 4. Next Steps (Out of Scope for v1.0)

- Maintenance & conformance suite expansion
- Additional adapters: Gnark (Go), STARK (GPU, Heavy infra)
- Heavy SaaS infra (Pro/Enterprise tiers, BatchSeal)
- Grant applications (Ethereum Foundation, ecosystem-specific)
