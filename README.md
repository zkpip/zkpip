# ZKPIP — Zero-Knowledge Proof Interoperability Project

> **Tagline:** Universal proof validator & schemas for cross-tooling ZK workflows (batch & mixed validation).

> **Status:** Documentation refresh in progress. The CLI package is the primary focus and already functional. This README reflects the latest direction; detailed per-package docs will land shortly.

[![TypeScript Strict](https://img.shields.io/badge/TypeScript-strict-blue)](#)
[![CLI First](https://img.shields.io/badge/focus-CLI%20first-success)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-informational.svg)](./LICENSE)

ZKPIP provides a **meta-layer** for the fragmented ZK tooling landscape: portable **schemas**, pluggable **adapters**, and a **CLI** that verifies proofs across multiple ecosystems (Circom/snarkjs, RapidSnark, gnark, Halo2, Plonky2—growing over time). The goal is simple: make **CI, audits, and dev workflows** consistent regardless of the underlying proving system.

---

## Why ZKPIP?

- **Interoperability by design:** One CLI + canonical JSON schemas → fewer bespoke scripts.
- **CI-ready from day one:** Deterministic inputs, strict typing, explicit exit codes.
- **Batch & mixed validation:** Validate multiple proofs (and multiple systems) in a single run.
- **Open standards mindset:** ProofEnvelope schema with a stable `$id` and consistent field names (e.g., `envelopeId`).

---

## Highlights (current)

- **CLI-first architecture:** The `@zkpip/cli` package is the largest and most actively updated package.
- **ProofEnvelope schema:** Canonical wrapper for proof, verification key, public inputs, and metadata.
- **Adapter layer:** Start with snarkjs; structure prepared for rapid addition of others.
- **Strict TypeScript:** No `any`, ESM, exact optional types, CI-friendly.

> Detailed per-adapter docs are being migrated. The CLI help and samples work today.

---

## Quickstart

```bash
# 1) Clone & install
git clone https://github.com/zkpip/zkpip
cd zkpip
pnpm i

# 2) Build all packages (monorepo)
pnpm -w build

# 3) Run the CLI (help)
pnpm -w zkpip:cli --help

# 4) Example verification (snarkjs sample)
pnpm -w zkpip:cli verify   --proof   samples/snarkjs/proof.json   --vk      samples/snarkjs/verification_key.json   --public  samples/snarkjs/public.json   --adapter snarkjs
```

> Tip: for local schema development, set `SCHEMA_DEV_ROOT=./packages/<schema-package>/schemas`.

---

## Monorepo at a glance

```
zkpip/
  packages/
    cli/                # @zkpip/cli — primary entrypoint, adapter-aware verify commands
    core/               # shared types, validation utils, schema loaders
    adapters/           # adapter packages (e.g., snarkjs, gnark, halo2, plonky2)
    schemas/            # canonical JSON Schemas (e.g., ProofEnvelope)
  samples/              # small proof/VK/public fixtures for smoke tests
  docs/                 # (WIP) user & adapter guides
  ZKPIPs/               # governance proposals (RFC-style)
```

> The CLI has absorbed most functionality and documentation. Package READMEs are being aligned.

---

## CLI — Examples

```bash
# Single proof
zkpip verify   --proof ./proof.json --vk ./verification_key.json --public ./public.json   --adapter snarkjs

# Batch (mixed systems)
zkpip verify   --manifest ./manifests/mixed.batch.json
```

**Exit codes**
- `0` = all proofs valid
- `1` = verification error(s)
- `2` = schema / IO / config error

---

## ProofEnvelope (JSON)

```json
{
  "$schema": "https://zkpip.org/mvs/proof-envelope.schema.json",
  "version": "0.2.0",
  "envelopeId": "ulid_01JEXAMPLEENVELOPEID",
  "proofSystem": { "name": "groth16", "tool": "snarkjs", "curve": "bn128" },
  "artifacts": {
    "proof": { "path": "./proof.json", "hash": "sha256-..." },
    "verificationKey": { "path": "./verification_key.json", "hash": "sha256-..." },
    "publicInputs": { "path": "./public.json", "hash": "sha256-..." }
  },
  "meta": { "tags": ["demo"] }
}
```

---

## Design principles

- **Deterministic by default:** hash-pinned inputs, explicit manifest format.
- **Strict validation:** JSON Schemas with stable `$id`; aliases resolved via a canonical map.
- **Adapter isolation:** thin, testable boundaries to integrate new proving stacks quickly.
- **Dev-first ergonomics:** helpful errors, minimal boilerplate, samples included.

---

## Roadmap (next)

1. **Adapter coverage:** gnark, Halo2, Plonky2 parity with snarkjs.
2. **Error Catalog:** standard error taxonomy with machine-readable codes.
3. **CI templates:** GitHub Actions samples (matrix across adapters & circuits).
4. **Docs site:** task-based guides (verify, batch, manifests, writing adapters).
5. **Reports:** optional JSON/Markdown reports for audits and dashboards.

---

## Contributing

We welcome issues and PRs. Please:
- keep code **strict TypeScript** (no `any`);
- write **English** comments and commit messages;
- include a **minimal reproducible sample** for adapter bugs.

See `ZKPIPs/` for governance/RFC flow (WIP).

---

## License

MIT — see [LICENSE](./LICENSE).

---

## Maintainer note (temporary)

This README is the interim, CLI-first snapshot. Package-level READMEs and a full docs site are coming shortly to reflect the evolved structure.

---

### BONUS: GitHub Description & Topics

- **Description:** `ZKPIP — Universal proof validator & schemas for cross-tooling ZK workflows (batch & mixed validation). CLI-first.`
- **Topics:** `zero-knowledge, zk, interoperability, circom, snarkjs, gnark, halo2, plonky2, typescript, cli, json-schema`

---

## Quick tasks

1) Replace this README in repo root.  
2) Update repo description & topics on GitHub.  
3) Confirm LICENSE consistency (MIT vs Apache).  
4) Ensure sample proof/VK/public exist in `/samples/snarkjs`.  
5) (Later) Add `.github/workflows/verify.yml` with adapter smoke tests.

---
