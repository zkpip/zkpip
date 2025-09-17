/* eslint-disable no-undef */
module.exports = {
  root: true,
  env: { es2022: true, node: true },
  ignorePatterns: ['**/node_modules/**', '**/dist/**', '**/coverage/**'],
  plugins: ['@typescript-eslint', 'import'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended', // non-type-aware rules only
    'plugin:import/recommended',
    'plugin:import/typescript',
    'prettier',
  ],
  overrides: [
    {
      files: ['**/*.ts', '**/*.tsx'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        // ⚠️ No `project` here => non-type-aware (fast, robust)
      },
      rules: {
        // Put TS-specific rules here if needed
      },
    },
    {
      files: ['**/*.js', '**/*.mjs'],
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    },
    {
      files: ['**/*.cjs', 'packages/**/scripts/**/*.js'],
      parserOptions: { ecmaVersion: 'latest', sourceType: 'script' },
      rules: {
        'import/no-commonjs': 'off',
        '@typescript-eslint/no-var-requires': 'off',
      },
    },
    {
      files: [
        'packages/cli/scripts/groth16-adapter-selftest.mjs',
        'packages/cli/scripts/plonk-adapter-selftest.mjs',
      ],
      rules: { 'import/no-unresolved': 'off' },
    },
  ],
  settings: {
    'import/resolver': {
      // Simpler TS resolver; doesn't require pointing at tsconfig projects
      typescript: { alwaysTryTypes: true },
      node: { extensions: ['.ts', '.tsx', '.js', '.mjs'] },
    },
  },
};
