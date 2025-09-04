// packages/cli/eslint.config.mjs
import js from '@eslint/js';
import globals from 'globals';
import importPlugin from 'eslint-plugin-import';
import * as tseslint from 'typescript-eslint';

export default [
  // Ignore-ok (a saját configot is hagyjuk békén)
  { ignores: ['dist/**', 'coverage/**', 'eslint.config.*'] },

  // Globális plugin-regisztrációk – csak EGYSZER!
  importPlugin.flatConfigs.recommended,   // <- 'import' plugin itt kerül be
  { plugins: { '@typescript-eslint': tseslint.plugin } }, // <- TS plugin egyszer globálisan

  // JS recommended
  js.configs.recommended,

  // Plain JS (Node ESM)
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node,
    },
  },

  // TypeScript (forrás + scriptek) – TYPE-CHECKED, EGY projekt
  {
    files: ['src/**/*.ts', 'scripts/**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: ['./tsconfig.eslint.json'],   // ← pontosan 1 projekt
        tsconfigRootDir: import.meta.dirname,
        noWarnOnMultipleProjects: true,
      },
      globals: globals.node,
    },
    // NINCS 'plugins' itt! (globálisan már regisztráltuk)
    settings: {
      // import resolver: TS forrásból oldja fel a monorepo importokat
      'import/parsers': { '@typescript-eslint/parser': ['.ts', '.tsx', '.d.ts'] },
      'import/resolver': {
        typescript: {
          project: [
            './tsconfig.eslint.json',
            '../../tsconfig.base.json',
            '../core/tsconfig.json',
            '../core/tsconfig.eslint.json',
          ],
          alwaysTryTypes: true,
        },
        node: { extensions: ['.ts', '.tsx', '.d.ts', '.js', '.mjs', '.cjs'] },
      },
    },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-floating-promises': ['error', { ignoreIIFE: true, ignoreVoid: true }],
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: false }],
      '@typescript-eslint/restrict-template-expressions': [
        'warn',
        { allowNumber: true, allowBoolean: true, allowNullish: true, allowAny: true },
      ],
      '@typescript-eslint/require-await': 'off',

      // NodeNext ESM: relatív TS importokra ne kelljen .js a forrásban
      'import/extensions': [
        'error',
        'ignorePackages',
        { js: 'always', mjs: 'always', ts: 'never', tsx: 'never', dts: 'never' },
      ],
    },
  },

  // Tesztek (Vitest globálokkal) – ugyanaz a projekt
  {
    files: ['src/__tests__/**/*.ts', 'tests/**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: ['./tsconfig.eslint.json'],
        tsconfigRootDir: import.meta.dirname,
        noWarnOnMultipleProjects: true,
      },
      globals: {
        ...globals.node,
        describe: true, it: true, test: true, expect: true,
        beforeAll: true, beforeEach: true, afterAll: true, afterEach: true, vi: true,
      },
    },
    // Itt sincs 'plugins'
    settings: {
      'import/resolver': {
        typescript: {
          project: ['./tsconfig.eslint.json', '../../tsconfig.base.json'],
          alwaysTryTypes: true,
        },
        node: { extensions: ['.ts', '.tsx', '.d.ts', '.js', '.mjs', '.cjs'] },
      },
    },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-misused-promises': ['warn', { checksVoidReturn: false }],
      'no-console': 'off',
    },
  },
];
