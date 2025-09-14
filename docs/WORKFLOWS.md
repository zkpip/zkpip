# CI Workflows (Core: `zkpip/zkpip`)

This document describes the CI architecture for the core repository.

## Overview

- **Schema Validation**: AJV-based validation of all core JSON Schemas.
- **Core CI**: Vitest with coverage thresholds (enforced).
- **Reusable Schema Guard**: A reusable workflow consumed by downstream repos (e.g. `zkpip/lab`).

## Workflows

- `.github/workflows/schema-validation.yml`
  - Validates schema files in `/schemas/**` and runs conformance checks.
- `.github/workflows/core-ci.yml`
  - `vitest` with coverage thresholds; fails build if thresholds are not met.
- `.github/workflows/reusable-schema-guard.yml`
  - **workflow_call** entrypoint consumed by external repos.
  - Inputs:
    - `include` (string, required): newline-separated glob list to include.
    - `exclude` (string, optional): newline-separated globs to exclude.
    - `annotate` (boolean, default `true`): annotate PR with findings.
    - `core_ref` (string, default `main`): ref/tag/SHA for the core checkout.
    - `core_repo` (string, default `zkpip/zkpip`): repository to clone as core.
    - `core_path` (string, default `__core`): checkout path for the core repo.
  - Behavior:
    - Public HTTPS clone first; token fallback for internal runs.
    - **Clean build** of `packages/core` to avoid stale `dist`.
    - Exports `CORE_ROOT` for downstream guard steps.

## Fork PR behavior

- The reusable guard avoids secrets on forks by using a public clone path.
- Any step that needs secrets must be gated by conditions (`if:`) so fork PRs do not fail.

## Required checks (when repository is public / paid plan for private)

- **Schema Validation**
- **Core CI**
- Reusable guard is **not** required here (it is **consumed** by downstream).

## Local debug

```bash
# Run schema validation locally
npm ci
npm run lint
npm test
```
