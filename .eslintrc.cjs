/* eslint-disable no-undef */
const path = require('node:path');
const ROOT = __dirname;

module.exports = {
  root: true,
  env: { es2022: true, node: true },
  ignorePatterns: [
    'fixtures/**',
    '**/node_modules/**',
    '**/dist/**',
    '**/coverage/**',
    '.eslintrc.cjs',
    'eslint.config.js',
    '*.mjs',
    'scripts/**/*.mjs',
  ],
  plugins: ['@typescript-eslint', 'import', 'vitest'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'prettier',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: [
      path.join(ROOT, 'tsconfig.eslint.json'),
      path.join(ROOT, 'packages/*/tsconfig.json'), path.join(ROOT, 'packages/**/tsconfig.json'),
    ],
    tsconfigRootDir: ROOT,
    sourceType: 'module',
    ecmaVersion: 'latest',
  },
  settings: {
    'import/parsers': {
      '@typescript-eslint/parser': ['.ts', '.tsx', '.d.ts', '.mts'],
    },
    'import/resolver': {
      node: { extensions: ['.js', '.mjs', '.ts'] },
      typescript: {
        project: [path.join(ROOT, 'tsconfig.eslint.json'), path.join(ROOT, 'packages/*/tsconfig.json'), path.join(ROOT, 'packages/**/tsconfig.json')],
        alwaysTryTypes: true,
      },
      alias: {
        map: [
          ['#fs-compat', path.resolve(ROOT, 'packages/cli/src/utils/fs-compat.ts')],
          ['#paths',     path.resolve(ROOT, 'packages/cli/src/utils/paths.ts')],
        ],
        extensions: ['.ts', '.js', '.mjs'],
      },
    },
    'import/core-modules': ['vitest'],
  },
  overrides: [

    {
      files: ['packages/adapters/**/src/**/*.ts'],
      rules: {
        'import/no-unresolved': 'off',
        'import/namespace': 'off'
      }
    },


    {
      files: ['packages/cli/src/**/*.ts'],
      rules: {
        'import/no-unresolved': 'off',
        'import/namespace': 'off'
      }
    },

    {
      files: ['**/*.d.ts'],
      rules: {
        '@typescript-eslint/consistent-type-imports': 'off'
      }
    },

    // Vitest globals in tests
    {
      files: ['**/__tests__/**/*.{ts,tsx}', '**/*.{test,spec}.ts'],
      env: { 'vitest/globals': true },
      rules: {
        'import/no-unresolved': 'off',
        'import/namespace': 'off',
        'no-unused-expressions': 'off',
      },
    },
    // Plain JS/MJS: lint via espree, do not use TS project
    {
      files: ['**/*.js', '**/*.mjs'],
      parser: 'espree',
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
      rules: {
        '@typescript-eslint/consistent-type-imports': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
    // Dev scripts
    {
      files: ['scripts/**/*.ts', 'packages/*/scripts/**/*.ts', 'packages/**/scripts/**/*.ts'],
      rules: {
        'import/no-unresolved': 'off',
        'import/namespace': 'off',
        'import/no-extraneous-dependencies': 'off',
      },
    },
  ],
  rules: {
    // Temporarily relaxed to avoid false positives under NodeNext
    'import/no-unresolved': 'off',
    'import/extensions': 'off',

    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
  },
};
