# ZKPIP Config Baseline (2025‑09‑23)

**What changed**
- `tsconfig.base.json`: NodeNext + Node types, `lib: ES2022`, `moduleDetection: force`.
- `tsconfig.eslint.json`: added `@zkpip/adapters-core` path; include `types/**/*.d.ts`.
- Root `package.json`: fixed `test:ws` (`--workspaces`), added missing ESLint import resolvers/plugins and `tsx`.
- `.eslintrc.cjs`: explicit parser settings, TS project reference for lint, resolvers (node, ts, alias), Vitest plugin.
- Package TS configs: ensured `types: ['node']` everywhere and kept strict ESM.

**Local quickstart**
```bash
# 1) Install (clean)
rm -rf node_modules && npm i

# 2) Type-check & build all referenced projects
npm run build

# 3) Lint (zero warnings enforced)
npm run lint

# 4) Tests (workspace)
npm --workspaces run test
```

**Notes**
- If `eslint-import-resolver-typescript` complains, ensure `node >= 18.18` and a clean `node_modules`.
- If adapters that rely on external libs (e.g., `snarkjs`) are built, install their peer deps locally for dev.
- Vitest types are applied to test files via the override; CLI still includes `vitest/globals` in `tsconfig.json`.
