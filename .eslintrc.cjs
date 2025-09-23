/* eslint-disable no-undef */
const path = require('node:path');
const ROOT = __dirname;

module.exports = {
  root: true,
  env: { es2022: true, node: true },
  ignorePatterns: ['**/node_modules/**', '**/dist/**', '**/coverage/**', '.eslintrc.cjs'],
  plugins: ['@typescript-eslint', 'import'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'prettier',
  ],
  overrides: [
    {
      files: ['**/*.d.ts'],
      rules: {
        'import/no-named-as-default': 'off',
        'import/no-unresolved': 'off',
      },
    },
    {
      files: ['**/*.ts', '**/*.tsx'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      rules: {
        'import/extensions': [
          'error',
          'always',
          {
            ignorePackages: true,
            pattern: {
              js: 'always',
              mjs: 'always',
              cjs: 'always',
              ts: 'never',
              tsx: 'never',
            },
          },
        ],
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
        '@typescript-eslint/no-require-imports': 'off',
      },
    },
    {
      files: [
        'packages/cli/scripts/groth16-adapter-selftest.mjs',
        'packages/cli/scripts/plonk-adapter-selftest.mjs',
      ],
      rules: { 'import/no-unresolved': 'off' },
    },
    {
      files: ['packages/**/scripts/**/*.mjs', '**/scripts/**/*.mjs'],
      rules: {
        'import/extensions': ['error', 'always', { ignorePackages: true }],
      },
    },
  ],
  settings: {
    'import/core-modules': ['#fs-compat', '#paths'],
    'import/resolver': {
      typescript: {
        project: [
          './tsconfig.paths.json',
          './packages/cli/tsconfig.json',
          './packages/core/tsconfig.json',
          './packages/adapters/snarkjs-groth16/tsconfig.json',
          './packages/adapters/snarkjs-plonk/tsconfig.json',
        ],
        alwaysTryTypes: true,
      },
      node: {
        extensions: ['.js', '.mjs', '.cjs', '.ts', '.tsx'],
      },
      alias: {
        map: [
          ['#fs-compat', path.resolve(ROOT, 'packages/cli/src/utils/fs-compat.ts')],
          ['#paths',     path.resolve(ROOT, 'packages/cli/src/utils/paths.ts')],
        ],
        extensions: ['.ts', '.js', '.mjs'],
      },    
    },
  },
  rules: {
    'import/extensions': ['error', 'always', { ignorePackages: true }],
  },
};
