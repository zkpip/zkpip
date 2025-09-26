# ZKPIP — MVS v1 Roadmap (UPDATED, EN)

> **Scope:** ProofEnvelope v1 (additive update), Can* schemas (CanCircuit / CanVector / CanWitness), CLI `forge|submit` + **offline verify**, ProofBridge PB-01 (ZoKrates → Canonical → snarkjs + Canonical ↔ snarkjs), Can-Registry (S3 + indexes), **ScanSeal** mini (search + envelope page), EF-ready “wow” UX (colorized CLI, QR, badge, progress bar, ScanSeal badge SVG).
>
> **Trademarks:** ZKPIP™, ProofEnvelope™, CanCircuits™, CanVectors™, CanWitnesses™, ProofBridge™, VectorForge™, CircuitForge™, WitnessForge™, ScanSeal™.

---

## 0) Objectives

- **Interoperability & reproducibility:** canonical forms (ProofEnvelope + Can*), deterministic canonicalization (JCS), `payloadDigest`.
- **Community value:** searchable / downloadable Can artifacts on **ScanSeal** (tiny suite), public index JSONs.
- **EF demo:** ProofBridge PB-01 + two-adapter offline verify (snarkjs + one more), live demo + short video.
- **Adoptability:** CLI “Forge → Submit” experience, subtle wow UX (colors, QR, badge), crisp docs.
- **Sustainability:** expiry + drift-monitor policy (documented), pinned Docker image digests.

---

## 0.5) Canonical Pages (zkpip.org) — *planning for EF submission*

*Implementation is deferred to just before grant submission to allow iteration; kept here as a planning item.*

Pages to prepare (short definition + JSON snippet + schema link):
- **ProofEnvelope v1** (JCS canonicalization, `payloadDigest`, link-graph example)
- **CanCircuit v1** (toolchain + Docker digest, structural circuit hash, setup, metrics)
- **CanVector v1** (scheme×curve×field, VK/PK/publicInputs digests, `expected.verify`, tag taxonomy)
- **CanWitness v1** (recipe-first privacy, deterministic seeding, digest format, metrics)
- **ZK Trust Chain™** (end-to-end trust narrative, expiry + drift)
- **ProofBridge™** (canonical mapping rules, accepted adapters, PB-01 route)

---

## 1) Specifications

### 1.1 ProofEnvelope v1 (additive)
- New fields: `kind`, `canonicalization="jcs-rfc8785"`, `payloadDigest`, `links[]`, `policy{expiryDays,privacy}`, `integrity{attachmentsMerkleRoot,totalBytes}`
- Consistent `envelopeId` everywhere
- `$schema`/`schemaUri` required, AJV 2020-12 validation

### 1.2 Can-schemas v1
- **CanCircuit v1:** `language`, `toolchain{version,dockerImageDigest,flags}`, `artifacts{structuralHash,irKind,irHash?,vkHash?,pkHash?}`, `setup{kind,scheme,curve,ceremonyRef?}`, `metrics{constraints,wires?}`, `license` (SPDX)
- **CanVector v1:** `scheme`, `curve`, `field`, `circuit{language,artifactHash,sourceHash?}`, VK/PK digests, `publicInputs[]`, `expected{verify,errorCode?}`, `tags[]`
- **CanWitness v1:** `generator{language,entry,dockerImageDigest,generatorHash,deterministic:true}`, `seedRule{domain,material[],prng}`, `items[{kind,publicInputsRef,witnessDigest{format,hash,sizeBytes?},expectedVerify}]`, **privacy = recipe-first**

### 1.3 Canonicalization & hashing
- **JCS (RFC-8785)** canonical payload → `payloadDigest = sha256/base64`
- Hash matrix where relevant: circuit / artifact / VK / PK / publicInputs / proof

---

## 2) CLI (MVS)

- `zkpip vector forge|test|submit` — tiny profile (8–12 vectors)
- `zkpip witness forge|test|submit` — digest-only witness set (8–12 items), deterministic seeding
- `zkpip circuit forge|test|submit` — deterministic build meta + baseline tiny profiles (when available)
- `zkpip verify --offline --adapters snarkjs,<other>` — one proof with two adapters, **single-proof offline validation**
- `zkpip bridge convert` — ProofBridge PB-01 routes (see §5)

All `forge|submit` commands compute and write **`payloadDigest`** and emit a persisted Envelope.

**Output (baseline):** stable JSON + exit codes, digest summary (VK/proof/`payloadDigest`), last line prints the **ScanSeal URL**.

---

## 3) ScanSeal (mini)

- **Search (facets):** kind, scheme, curve, language, tags, updated
- **Envelope detail:** manifest + hash matrix, artifact download, Seal status (green/amber/expired)
- **Badge snippet:** embeddable README badge (SVG), live status link
- **Indexes:** `id-map.json` (URN→path/digest), `hash-index.json` (digest→URN)

---

## 3.5) CLI “wow” features (before EF submission)

- **Colorized CLI + frame** (**0.25 day**)
- **QR code** for the ScanSeal URL (**0.25 day**)
- **Seal icon + badge link** (**0.25 day**)
- **Fake progress bar** (**0.25 day**) — UX only; never masks failure
- **ScanSeal badge SVG** (**0.25–0.5 day**) — consistent embedding

*Acceptance:* visible in `verify --offline` and `submit` outputs; URL/QR resolves to the newly published Envelope page.

---

## 4) Deliverables (MVS v1 GA, updated)

- **Schemas:** ProofEnvelope v1 + CanCircuit/CanVector/CanWitness v1 + AJV tests
- **CLI:** `forge|submit` (vector, witness[, circuit]), **offline validation** (snarkjs + one extra adapter), stable JSON + exit codes
- **ProofBridge PB-01 (MVS):** ZoKrates → Canonical → snarkjs (one-way) + Canonical ↔ snarkjs (two-way); CPU-only, single-proof offline verify
- **Can-Registry:** S3 layout + `id-map.json`, `hash-index.json`, tiny suite published
- **ScanSeal (mini):** search + envelope detail + badge
- **Docs:** quickstart, schema guide, CI workflow; **Canonical Pages (planning)** and **CLI wow** usage notes
- **Demo assets:** tiny Groth16/BN254 suite (8–12 vectors, 8–12 witnesses), two-adapter pass report (`report:verify` Envelope)
- **Demo video:** 60–90 s pre-recorded run (CLI → ScanSeal)

---

## 5) ProofBridge PB-01 (baseline)

**Goal:** demonstrate cross-tool interoperability via a canonical middle form (ProofEnvelope + `g16-proof-v1` / `g16-vk-v1`).

**Routes:**
- **ZoKrates → Canonical → snarkjs** (one-way)
- **Canonical ↔ snarkjs** (two-way)

**Rules:**
- Coordinate order: `G1 = [x,y]`, `G2 = [[x.c0,x.c1],[y.c0,y.c1]]`; all numbers **0x-hex**
- Public input order fixed; JCS-canonicalization + `payloadDigest`
- Pin Docker digests for ZoKrates/snarkjs environments

**Output:** `report:verify` Envelope (adapters, pass/fail, digests, runtime metrics)

---

## 6) Milestones (updated)

- **M1 — Specs ready** (Week 1–2)  
  ProofEnvelope v1 additive + AJV ✅; CanCircuit/CanVector/CanWitness v1 ✅; JCS canonicalization util + `payloadDigest` ✅

- **M2 — CLI & tiny suite** (Week 2–3)  
  `vector/witness forge|submit` + deterministic seeding ✅; tiny suite v0 (8–12 + 8–12) Groth16/BN254 ✅

- **M3 — Offline verify + 2nd adapter** (Week 3–4)  
  `verify --offline` snarkjs driver ✅; second adapter (ZoKrates **or** gnark) happy-path ✅; cross-adapter pass rate ≥ **95%** on the tiny suite ✅

- **M4 — ProofBridge & Registry** (Week 4)  
  PB-01: ZoKrates → Canonical → snarkjs + Canonical ↔ snarkjs ✅; S3 Registry + `id-map.json` / `hash-index.json` ✅; tiny suite v1 published ✅

- **M5 — ScanSeal & Docs & Wow** (Week 5)  
  ScanSeal mini (facets + detail + badge) ✅; quickstart + schema guide + CI how-to ✅; CLI wow features (colors, QR, badge, progress bar, ScanSeal badge SVG) ✅; pre-recorded demo video ✅

- **M6 — Stabilization & EF package** (Week 6)  
  Round-trip polish; CI on Linux/macOS; Docker digests pinned; deterministic JCS checks; EF 1-pager + KPI table; final dry-run (zero flakes) ✅

---

## 7) Acceptance criteria (EF-submittable state)

- **Live** ScanSeal mini (search + detail + downloads), ≥20 Can artifacts listed
- **CLI demo:** `forge|submit`, `verify --offline`, `bridge convert` working
- **Interoperability:** two-adapter pass on tiny suite; `report:verify` Envelope published
- **Reproducibility:** JCS-based `payloadDigest`, Docker digests pinned
- **Docs:** 3 short pages (quickstart, schema guide, CI); Canonical Pages are **planned** and listed

---

## 8) Risk controls

- **Format edges (G2/Fq2 ordering):** fixed mapping + golden test vectors
- **Toolchain drift:** Docker digest pinning + expiry re-run; “amber” status on mismatch
- **Scope creep:** one curve (BN254), one scheme (Groth16), two adapters for MVS; others in v1.1+

---

## 9) Pre-submission Go/No-Go checklist

- [ ] AJV tests green for Envelope v1 + Can* v1
- [ ] Tiny suite published (S3), visible in ScanSeal; downloads work
- [ ] `verify --offline` stable on two adapters (≥95% pass)
- [ ] PB-01 routes working; `report:verify` Envelope emitted
- [ ] CLI “wow” elements visible (colors, QR, badge, progress bar, ScanSeal badge SVG)
- [ ] Demo video (60–90 s) recorded; links included in EF package
- [ ] EF 1-pager + KPI table finalized; Canonical Pages still *planning* (to be published right before submission)
