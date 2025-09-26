# ZKPIP — EF Grant #1 Roadmap (25k USD / 3 months, buffered) — Post-MVS Increments Only

> **Important:** This grant **excludes** all items already planned/delivered in **MVS v1** (schemas; CLI `forge|submit`; offline verify with two adapters; ProofBridge PB-01; ScanSeal mini; CLI WOW; demo video). This package funds **only incremental, low-risk, high-impact work beyond MVS**.

## One-paragraph summary
We will harden the Ethereum-first interoperability baseline **beyond MVS** by adding: a **Seal (light) issuer** with status surfaces and a **drift monitor**, a scriptable **CrossProof Validation harness**, expanded **golden vectors**, **ABI/calldata canonicalization** with a minimal **Hardhat/Foundry smoke plugin**, a public **read-only Registry API**, plus two **ScanSeal enhancements**: a **Timeline view** for artifact lifecycle and a **Badge gallery with embeddable snippets**. Budget: **$25k**, duration: **3 months (solo)**, with generous buffers.

---

## Scope — strictly post-MVS
**Already in MVS (not funded here):** schemas & JCS payloadDigest; CLI forge/submit; offline verify (snarkjs + 1 extra); ProofBridge PB-01 (ZoKrates → Canonical → snarkjs + Canonical ↔ snarkjs); ScanSeal mini; CLI WOW (colors/QR/badge/progress); demo video.

**This grant covers:**
1) **Seal (Light) Issuer & Status Surfaces**
   - Rule-based issuer: schema pass, cross-adapter parity thresholds, expiry assignment.
   - Public status on **ScanSeal**: **issued / amber / expired**, machine-readable status JSON.
   - Minimal moderation hooks (revoke/supersede), and linkbacks to related ProofEnvelopes.

2) **Drift Monitor (Reliability)**
   - Scheduled re-runs with pinned Docker digests; detect toolchain/version drift.
   - Auto-amber on mismatch; operator log + simple webhook/notify hook.

3) **CrossProof Validation Harness (Scriptable)**
   - Adapter-agnostic runner to execute **≥2 adapters** on the same canonical inputs.
   - Emits a signed `report:verify` ProofEnvelope; CI-friendly JSON summary.
   - Configurable parity policy (e.g., PASS/FAIL equality; optional normalized-output checks).

4) **Golden Vectors Expansion & Conformance Pack**
   - Beyond the tiny set: **boundary** and **malformed** classes; witness mutation series.
   - AJV conformance tests tightened for **g16-proof/vk v1** and **Can* v1** schemas.

5) **ABI/Calldata Canonicalizer + Mini EVM Plugin**
   - Deterministic calldata encoder (hex normalization, field sizes, G1/G2 Fq2 mapping).
   - Minimal **Hardhat/Foundry smoke plugin** for local Anvil (**tx success/revert** only).

6) **Read-only Registry API (Public)**
   - `GET /api/v1/search` (facets + paging), `GET /api/v1/envelopes/{id}`, `GET /api/v1/artifacts/{digest}`
   - CORS-enabled, rate-limited; mirrors the static index JSONs for integrators.

7) **ScanSeal Enhancements (UI)**
   - **Timeline view**: visualize an artifact lifecycle *(submit → verify report → issued/amber/expired)* with deep-links.  
   - **Badge gallery + embed code**: preview badge variants *(light/dark/compact)* and provide copy-paste snippets.

> **Out of scope:** generalized Forge kernel; BatchForge/BatchSeal; ceremony/PoT; heavy proving.

---

## Deliverables
- **Seal Light:** issuer service with objective rules; ScanSeal status pages & status JSON; governance notes (expiry/amber/revoke).
- **Reliability:** drift monitor job + auto-amber; Docker digests pinned; operator logs.
- **Interop Harness:** CrossProof Validation runner; signed `report:verify` envelopes; CI examples.
- **Golden & Conformance:** published golden vectors (boundary/malformed); stricter AJV packs for g16-proof/vk v1 and Can* v1.
- **EVM Touchpoint:** ABI/calldata canonicalizer; Hardhat/Foundry smoke plugin (local Anvil).
- **Registry API (read-only):** search + envelope/artifact endpoints; simple API key & rate limiting; docs.
- **ScanSeal UI (incremental):**
  - **Timeline view** (artifact lifecycle with links).  
  - **Badge gallery + embeddable snippets** (light/dark/compact).

---

## Timeline (12 weeks with buffers)
**Solo dev; conservative pacing. Weeks indicate primary focus; buffers are intentional.**

### Month 1
- **W1:** CrossProof harness skeleton; CI-friendly summary format; AJV conformance update.  
- **W2:** Adapter hardening edge cases (Fq2 ordering, endian); mapping tables; error taxonomy.  
- **W3:** Seal issuer (light), rule engine (parity threshold, schema pass, expiry).  
- **W4 (BUFFER):** Stabilize harness + issuer; pin Docker digests; start golden vectors (boundary/malformed).

### Month 2
- **W5:** ScanSeal **Timeline view** (submit → verify → issued/amber/expired) with deep-links.  
- **W6:** **Badge gallery + embed code** (light/dark/compact) with copy-paste snippets.  
- **W7:** ABI/calldata canonicalizer; deterministic ordering & 0x-hex normalization; begin Hardhat/Foundry smoke plugin.  
- **W8 (BUFFER):** Finish smoke plugin; polish canonicalizer; docs draft; initial Registry API scaffold.

### Month 3
- **W9:** Drift monitor (scheduled re-runs; auto-amber on drift) + operator logs.  
- **W10:** Read-only Registry API (search + envelope/artifact) + CORS/rate limit.  
- **W11:** Integrator docs (issuer/status JSON/ABI/harness/API); examples & snippets.  
- **W12 (BUFFER/FINAL):** Full end-to-end dry run; KPI snapshot; EF package (changelog + links).

---

## Milestones & Acceptance
- **M1 — Harness + Issuer (end Month 1)**  
  CrossProof harness v1 emits `report:verify` envelopes; parity checks configurable.  
  Seal issuer (light) accepts requests; rule engine active; initial golden vectors published.

- **M2 — UI & EVM (end Month 2)**  
  **Timeline view** live on ScanSeal; **Badge gallery** live with working embed snippets.  
  ABI/calldata canonicalizer + Hardhat/Foundry smoke plugin working locally.

- **M3 — API & Reliability (end Month 3)**  
  Drift monitor active; auto-amber on version drift; scheduled re-runs pass.  
  Read-only Registry API live; integrator docs published; CI green.

---

## KPIs (end-of-grant)
- **Parity:** ≥95% PASS parity across two adapters on golden subsets.  
- **Seals:** ≥10 items with **issued/amber/expired**; ≥1 drift-induced **amber** example.  
- **UI Adoption:** ≥3 external repos embed the **badge** or link the **Timeline view**.  
- **Reliability:** deterministic reruns on Linux/macOS; pinned Docker digests in manifests.  
- **API:** Registry API serves search & get within SLA (p95 < 300 ms on cached reads).

---

## Budget (25,000 USD)
- Dev & testing (12 weeks incl. buffers): **$18,000**  
- Infra (S3/CloudFront, CI minutes, small credits): **$2,000**  
- Docs & integration examples: **$1,500**  
- Contingency (adapter quirks, drift fixes, UI polish): **$3,500**  
**Total:** **$25,000**

**Licensing:** code under MIT/Apache-2.0; specs/schemas open.

---

## Risks & Mitigations
- **Adapter format edges:** canonical mapping tables + golden vectors; CI parity tests.  
- **Toolchain drift:** pinned digests; drift monitor → auto-amber; scheduled re-runs.  
- **Schedule risk:** three buffer weeks; ETH-first focus; defer heavy compute.  
- **Licensing/privacy:** SPDX required; witness stays **recipe-first** (digest-only public).

---

## Reporting
- Bi-weekly public updates (short changelog + KPI snapshot).  
- ScanSeal status pages for examples; final package with links, CI logs, docs & KPI table.

---

## Stretch (if ahead of schedule)
*Not part of the core deliverables; executed only after M1–M3 acceptance and only if time remains. Low-risk incremental value, no dependencies from the core plan.*

- **Two-way ZoKrates ↔ Canonical** — extend PB-01 beyond one-way by adding the reverse mapping if stability allows.
- **Third adapter spike (gnark or Noir/ACIR)** — parity spot-check only; no GA commitment.
- **Local on-chain smoke (Anvil)** using the calldata canonicalizer — demo-only (tx succeeds/reverts).

