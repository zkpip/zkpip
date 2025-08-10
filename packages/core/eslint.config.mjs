// Flat-config for ESLint v9+ in @zkpip/core

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

// Resolve __dirname in ESM
const __dirname = dirname(fileURLToPath(import.meta.url));

export default [
  // Ignore build artifacts and the config file itself
  {
    ignores: ['dist/**', 'build/**', 'node_modules/**', 'eslint.config.*']
  },

  // Base JS recommendations (defines `js`)
  js.configs.recommended,

  // TypeScript recommendations with type information
  ...tseslint.configs.recommendedTypeChecked,

  // TS rules for the codebase
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: ['./tsconfig.eslint.json'],
        tsconfigRootDir: __dirname
      },
      globals: {
        ...globals.node
      }
    },
    rules: {
      'no-console': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
    }
  },

  // CLI overrides: console is fine; no require-await; relax unsafe rules for CLI glue
  {
    files: ['src/cli/**/*.{ts,tsx}'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off'
    }
  }
];
