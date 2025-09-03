# ZKPIP --- Zero-Knowledge Proof Interoperability Project

ZKPIP is an open-source initiative to improve **interoperability** in
the zero-knowledge ecosystem.Our goal is to provide **portable formats, verifiers, and tools** that
make ZK proofs easier to validate and reuse across different frameworks.

------------------------------------------------------------------------

## Current Focus

The first package of this monorepo is:

-   **[@zkpip/core](./packages/core/)**    Off-chain verifier CLI with multiple adapters (`snarkjs`,
    `rapidsnark`, `gnark`) and a local "verified" badge generator.    → [Read more](./packages/core/README.md)

------------------------------------------------------------------------

## Roadmap (high level)

-   **Core CLI & Schemas** --- MVS release, JSON Schemas + CLI verifier
-   **Error Catalog** --- standard taxonomy of ZK error types
-   **Lab** --- experimental crawlers & classification pipelines
-   **zkTools (future)** --- developer-facing CLI & API utilities

------------------------------------------------------------------------

## Repository Structure

``` text
zkpip/
 ├─ packages/
 │   └─ core/          # @zkpip/core verifier CLI
 │
 ├─ schemas/           # Shared JSON Schemas
 ├─ ZKPIPs/            # Governance documents (ZKPIP-XXXX.md)
 └─ ...                # Future modules (error-catalog, lab, tools)
```

------------------------------------------------------------------------

## Naming

**ZKPIP** can be read in two ways:

-   **Zero-Knowledge Proof Interoperability Project** --    the open-source initiative and umbrella repository you are looking
    at.
-   **Zero-Knowledge Proof Improvement Proposal** --    the planned proposal format (similar to Ethereum's EIPs or Bitcoin's
    BIPs),    which will define and standardize ZK-related specifications.

This dual meaning is intentional:the **Project** exists to host tools and schemas, while the
**Proposals** will define long-term community standards.

------------------------------------------------------------------------

## Community & License

-   **Homepage:** [zkpip.org](https://zkpip.org)-   **Repository:**
    [github.com/zkpip/zkpip](https://github.com/zkpip/zkpip)-   **License:** Apache-2.0


------------------------------------------------------------------------

## Schema Loader Rules & Alias Behavior

**Scope.** The Core loader resolves schemas by canonical `$id` and supports a limited alias map for internal developer experience (DX).

**Resolution order.**
1. **Canonical `$id`** (preferred): exact match must resolve to a single schema.
2. **Alias map**: short keys map to canonical `$id`. Aliases must be injective (no collisions).
3. **Local fallback (dev-only)**: if `SCHEMA_DEV_ROOT` is set, disk resolution is allowed for rapid iteration.

**Rules.**
- Every loaded schema must expose a unique canonical `$id`.
- Aliases must not shadow canonical `$id` values.
- Loader MUST reject:
  - duplicate `$id`
  - alias cycles or collisions
  - ambiguous resolutions

**Alias examples.**
```ts
export const SCHEMA_ALIASES = {
  "mvs.proofBundle": "https://zkpip.org/mvs/proof-bundle.schema.json",
  "mvs.cir": "https://zkpip.org/mvs/cir.schema.json"
} as const;
```

**Environment variable for local development.**
```bash
export SCHEMA_DEV_ROOT=./packages/core/schemas
```

**Validation gates.**
- Unit tests ensure:
  - all core schemas compile
  - canonical `$id` uniqueness
  - alias map injective & acyclic
