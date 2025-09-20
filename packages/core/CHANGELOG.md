# Changelog — @zkpip/core

All notable changes to this project will be documented in this file.  
This project adheres to [Semantic Versioning](https://semver.org/).

---

## [0.1.0] — 2025-08-27

### Added

- Initial release of `@zkpip/core` with CLI and schema validation.
- Support for proof-envelope validation against canonical JSON Schemas.
- Adapters:
  - `snarkjs`
  - `rapidsnark`
  - `gnark`
- Offline SVG "verified" badge generation.

### Infrastructure

- **Schema lint guards**:
  - `$ref` must be either URN + fragment or local fragment.
  - `$schema` must always be a draft URL (2020-12).
  - `$id` must match canonical URN (`CANONICAL_IDS`), uniqueness enforced.
- **CI jobs**:
  - `lint-schemas`: schema references + ID checks.
  - `schema-validation`: AJV-based validation.
  - `core`: build, typecheck, test + coverage.
- **Coverage**:
  - Vitest coverage integrated with `@vitest/coverage-v8`.
  - `lcov.info` uploaded as CI artifact.
  - Default thresholds set to 80%.

---

## [Unreleased]

- Additional adapters (e.g. Halo2, Plonky2).
- Expanded vector tests.
- Improved developer documentation.

## [0.2.0] - 2025-09-20
### Added
- New **ProofEnvelope** schema: `urn:zkpip:mvs:schemas:proofEnvelope.schema.json`.
  - `anyOf`: **embedded result** (`result.proof`, `result.publicSignals`) **or** **artifact paths** (`artifacts.vkey/proof/publicSignals`).
  - `ArtifactRef` with required `path`, optional `uri`, `size`, `mediaType`, `hash.sha256`.

### Changed
- `bundleId` → **`envelopeId`** (URN UUID) across schema, vectors, and tests.
- AJV alias registry enhanced in `addCoreSchemas`: dotted ↔ `:schemas:` URN forms; additional legacy aliases.

### Compatibility
- Adapters accept legacy fields (`publics` vs `publicSignals`, legacy `bundle`/`result` locations).
- Filename routing recognizes `*.proof-envelope.json`.

### Migration Notes
- Use URN-formatted `envelopeId`.
- Prefer `publicSignals`.
- When using the embedded `result` branch, keep top-level `artifacts: {}` (this requirement can be relaxed in a later minor).

