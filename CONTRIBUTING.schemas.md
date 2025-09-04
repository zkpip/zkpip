# Contributing to ZKPIP Schemas

1. Propose changes via PR against this repo.
2. Update example files in `data/samples/`.
3. Ensure CI passes (`schema:check`).
4. For breaking changes, bump `@zkpip/core` minor/major and add a MIGRATION note.

## Schema Guard (CI)

All JSON records are validated against the shared ZKPIP JSON Schemas via a reusable GitHub Actions workflow.

### How it works

- The caller workflow (this repo) triggers the reusable `schema-guard.yml`.
- That workflow checks out `zkpip/zkpip` on the **same branch/tag** as this repo, builds the core package, and runs the internal validator (`validateFileBatch`).

### Local check (optional)

Validation logic lives in `zkpip/zkpip` (packages/core). You can run local checks there:

```bash
cd zkpip/zkpip
npm ci
npm run build --prefix packages/core
# run your local validator CLI as documented in that repo
```

### CI usage

- Configure include patterns with `paths`.
- Temporary exclusions can be added via `exclude` (comma or newline separated).
- On failure, the job writes minimal annotations per file. Optionally, it uploads a failure bundle artifact.

### PR policy

- Please commit only schema-valid JSON files.
- If the job fails, fix fields according to the schema and re-run the checks.
- Keep exclusions short-lived (drafts/migrations only).
