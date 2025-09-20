## [0.2.0] - 2025-09-20
### Added
- Script: `docs:examples:validate` — validates ProofEnvelope docs examples.
- New adapter tests: load triplets from `artifacts` paths (groth16, plonk, zokrates).

### Changed
- Adapters: consistent named export — `export function extractTriplet(...)` (+ optional default export).
- Path routing & normalization aligned with ProofEnvelope (`publicSignals` preferred).

### Compatibility
- Legacy inputs still supported (e.g., `verification_key`, `publics`, and older `bundle/result` placements).
