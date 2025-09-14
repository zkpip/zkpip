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

---

## 1) Specifications (freeze for v1)

- **ProofEnvelope** schema + **Adapter Contract** (inputs/outputs, error taxonomy, exit codes).
- **JSON Schema** validation for CLI inputs and manifests.
- **Normalization rules** (e.g., public signals must be strings; stable BigInt/string handling).
- **Versioning:** Semantic versioning; “v1” freeze prior to GA.

**Acceptance:** All three adapters pass conformance tests; CLI returns stable JSON + exit codes; schema violations return `schema_invalid` with clear paths.

---

## 2) CanVectors™ (Canonical ZK Test Vectors)

- **Manifest v1:** JCS-canonical JSON; fields: `version,id,framework,proofSystem,urls,sha256,size,meta,kid`.
- **Authenticity:** Detached **ed25519** signature (`manifest.sig`), `kid`-based keyring; public **JWKS** served by zkpip.org.
- **Integrity:** SHA-256 per artifact; CLI re-checks all hashes after fetch.
- **CLI integration:** `--vector-id can:<framework>:<proofSystem>:<suite>:<validity>`; providers: `HttpProvider` (VectorForge™) + `LocalFsProvider`.
- **Cache:** `~/.cache/zkpip/canvectors/<id>/` with `--offline/--no-cache` flags.

**Acceptance:** Tampered manifest → `signature_invalid`; tampered artifact → `hash_mismatch`; offline runs from cache when allowed.

---

## 3) Adapters (CPU-only, Ethereum-centric)

- **snarkjs-plonk** (BN254)
- **snarkjs-groth16** (BN254)
- **zokrates-groth16** (BN254)
- **Circom compatibility:** artifacts **extractor/normalizer** (vk/proof/publics → snarkjs adapter inputs).
- **Out-of-scope v1:** zkEVM, Halo2/KZG, Plonky2, Risc0 (v1.1+).

**Acceptance:** Valid vectors → `ok:true` / exit 0; tampered publics/proofs/vk → `verification_failed` / exit 1; missing fields → `adapter_error`.

---

## 4) SwiftSeal™ v1-server (server-signed seals + public scan)

**Goal:** Server verifies up to **10 proofs**, signs a canonical **Seal**, hosts a **scan page** and a **badge (SVG + QR)**.

### 4.1 API (v1)

- `POST /v1/seals` → request to verify **≤10 proofs** (normalized inputs or references to fetched CanVectors artifacts).  
  Server **re-verifies** using CPU-only runtimes; if **OK**: produces `seal.json` (JCS) + detached **ed25519** signature and persists both.  
  Returns `{ sealId, scanUrl, badgeUrl }`.
- `GET /v1/seals/{sealId}` → returns canonical `seal.json` (+ signature).
- `GET /v1/badge/{sealId}.svg` → QR-embedded SVG badge linking to scan URL.
- `GET /v1/keys.json` → public JWKS (for signature verification, with `kid` rotation).

### 4.2 Data model (seal.json, JCS)

- `version: "1"`
- `issuer: { name: "ZKPIP SwiftSeal", kid: "<ed25519 key id>" }`
- `subject: { proofCount, adapters: [...], vectors?: [...ids...] }`
- `artifacts: [ { vkHash, proofHash, publicHash }, ... ]` _(no raw proofs)_
- `result: "verified"`, `verifiedAt: <ISO8601>`
- `tooling: { runtime: "node22", snarkjs: "0.7.5", cli: "<ver>", commit: "<sha>" }`
- Optional: `aux: { repo?: "<url>", ci?: "github-actions" }`

**SealId:** `sha256(canonical(seal.json))` (hex or base58).

### 4.3 Implementation sketch (AWS-friendly)

- **API Gateway + Lambda (Node 22)** for POST/GET.
- **Verification worker** (Lambda/Fargate) with snarkjs/ZoKrates in container; ≤10 proofs handled synchronously.
- **Storage:** DynamoDB (meta), S3 (seal.json, badge.svg).
- **Signing:** **AWS KMS ed25519**, `kid` rotation, revoked keys visible in JWKS.
- **CDN:** CloudFront for S3 + scan pages.
- **SealScan™:** statically hosted app (Next.js/SSG or SPA) that fetches `seal.json` and verifies signature client-side against `/v1/keys.json`.

**Acceptance:**

- POST with valid inputs → 201 + seal links; tamper/invalid → clear error (`verification_failed`, `schema_invalid`, etc.).
- Scan page shows “Verified” and metadata; client-side signature check passes.
- Badge QR opens the scan page; rendering accessible (alt text, minimal size constraints).

---

## 5) Developer Experience & Distribution

- **NPM:** `@zkpip/cli` (verify + canvectors + seal request); zero-`any` TypeScript, ESM-only, lint-clean.
- **GitHub Actions:** reusable workflow:
  1. `zkpip verify …`
  2. `zkpip seal request --api <url>`
  3. Upload artifacts (`seal.json`, `badge.svg`) and post a link/comment or update README (optional).
- **Docs:** quick start (3 commands), clear error taxonomy, ToS/Trademark/Copyright.

**Acceptance:** A sample repo integrates in <10 min; badge visible in README; links resolve to scan pages.

---

## 6) Deliverables (v1 GA)

- **Specs:** ProofEnvelope v1, Adapter Contract v1, Manifest v1.
- **CLI:** verify + vectors fetch/cache + seal request; stable JSON + exit codes; schema validation.
- **Adapters:** snarkjs-plonk, snarkjs-groth16, zokrates-groth16 + Circom extractor.
- **CanVectors:** signed manifests, minimal canonical suites (valid + ≥3 invalid per adapter), hosted via **VectorForge™**.
- **SwiftSeal v1-server:** APIs, server-signed seals, badges with QR, **SealScan** public pages, JWKS keyring.
- **CI templates:** GitHub Actions workflow + status badge instructions.
- **Docs:** Roadmap, SCHEMA-GUIDE, CI-WORKFLOWS, TRADEMARKS, COPYRIGHT, ToS (vectors).

---

## 7) Out of Scope (v1 → v1.1+)

- **BatchSeal** (10–100 proofs, async pipeline).
- Search/index/browse features in SealScan (beyond per-Seal pages).
- Additional proof systems (Halo2/KZG, Plonky2, Risc0, zkEVM).
- Accounts/SSO/Billing.

---

## 8) Risks & Mitigations

- **Non-deterministic toolchains** → pin versions; normalize BigInt/string; CI reproducibility notes.
- **Key rotation/trust** → JWKS with `kid`, rotation policy, revoked set published.
- **Abuse** → ≤10 proofs/request, input limits, basic rate limiting; later GitHub OIDC for provenance.
- **Latency** → synchronous verification target: sub-5s for typical vectors (tune worker sizes; cache canonical vectors).

---

## 9) Milestones (suggested)

- **M1 (Spec & Vectors):** Spec freeze; minimal CanVectors signed sets; CLI fetch/cache.
- **M2 (Adapters & CLI):** 3 adapters conformance green; Circom extractor; error taxonomy stable.
- **M3 (SwiftSeal v1-server):** POST/GET APIs; KMS signing; SealScan per-Seal pages; badge + QR.
- **M4 (DX/CI & GA):** GitHub Action + docs; sample repos live; v1 GA tag.

---
