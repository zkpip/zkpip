# Test Vector Layout (MVS v1)

**Categories**

- `verification/` — Core verification use-cases.
  - Files: `<system>[-<target>][-<variant>].<outcome>.json`
  - Examples: `groth16-evm.valid.json`, `groth16-evm.invalid.json`
  - Schema-focused subfolders:
    - `verification/proofSet/` → `valid.json`, `invalid.json`
    - `verification/cir/` → `valid.json`, `invalid.json`
- `issue/` — Bug and edge-case reproductions.
  - Examples: `public-input-order.json`, `gh-1234-missing-signal.json`
- `ecosystem/` — Real-world examples by ecosystem.
  - Examples: `aztec.json`, `zksync.json`

**Outcomes**

- `.valid.json` and `.invalid.json` suffixes are mandatory for verification vectors.

**Globs**

- All vectors: `mvs/**/*.json`
- Verification (valid): `mvs/verification/**/*.valid.json`
- Verification (invalid): `mvs/verification/**/*.invalid.json`
