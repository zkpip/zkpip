# @zkpip/core

**ZKPIP Core** — off-chain verifier toolkit for zero-knowledge proofs.  
Provides a CLI with multiple adapters and a local "verified" badge generator.

---

## Features

- Validate proof-bundles against canonical JSON Schemas  
- Verify proofs with adapters:
  - [`snarkjs`](https://github.com/iden3/snarkjs)
  - [`rapidsnark`](https://github.com/iden3/rapidsnark)
  - [`gnark`](https://github.com/ConsenSys/gnark)
- Generate an offline SVG "verified" badge

---

## Quickstart

Install:

```bash
npm install -g @zkpip/core
```

Validate a proof-bundle:

```bash
zkpip validate ./vectors/proof-bundle.json
```

Verify with an adapter:

```bash
zkpip verify --adapter snarkjs --bundle ./vectors/proof-bundle.json
```

Generate a badge:

```bash
zkpip badge --out ./badge.svg
```

---

## Project

- **Homepage:** [zkpip.org](https://zkpip.org)  
- **Repository:** [github.com/zkpip/zkpip](https://github.com/zkpip/zkpip)  
- **License:** Apache-2.0  
- **Author:** Tony Nagy - https://tonynagy.io

---

## Status

This is the **first 0.1 release** of `@zkpip/core`.  
Interfaces may change until version 1.0.

---

## Development

Install dependencies:

```bash
npm ci
```

Run type checking:

```bash
npm run typecheck
```

---

## Testing

Run the full test suite (Vitest):

```bash
npm test
```

Run tests with coverage:

```bash
npm run coverage
```

or explicitly:

```bash
npm run -w @zkpip/core coverage
```

Coverage reports are generated in `packages/core/coverage/`  
and include `lcov.info` for CI artifact upload.

### Coverage thresholds

By default, the project aims for ≥80% on statements, functions, branches, and lines.  
These thresholds can be configured in `vitest.config.ts`.

---

## CI

- The `core` job runs typecheck, tests, and coverage.
- The `lint-schemas` job ensures schema `$id`, `$ref`, and `$schema` conventions.
- Coverage (`lcov.info`) is uploaded as a build artifact.
