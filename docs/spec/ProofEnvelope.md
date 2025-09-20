### Authoring Guidelines (ProofEnvelope v1)

- **ID**: `envelopeId` must be a URN UUID (`urn:uuid:...`).
- **Schema**: `schemaVersion` must be `"0.1.0"`.
- **System/Curve**: `proofSystem: "groth16"`, `curve: "bn128"|"bn254"`.
- **Prover**: `"snarkjs"` *or* `{ "name": "snarkjs", "version": "..." }`.
- **Program**: `{ "language": "circom", "entry": "...", "name": "..." }`.
- **Pick one branch**:
  - **Embedded**: `result.proof` + `result.publicSignals` (keep top-level `artifacts: {}` in current schema).
  - **Artifacts**: `artifacts.vkey/proof/publicSignals` as `ArtifactRef { path }` (+ optional `wasm`/`zkey`).
- **Naming**: prefer `publicSignals` (tooling tolerates `publics`).
- **Filename**: use `*.proof-envelope.json` for automatic schema routing.
