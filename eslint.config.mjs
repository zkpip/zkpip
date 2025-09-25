// eslint.config.mjs
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const rootDir = dirname(fileURLToPath(import.meta.url));
const STRICT = process.env.STRICT_LINT === '1'; 

const tsProjects = ['packages/*/tsconfig.json', 'packages/*/tsconfig.build.json'];

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/dist-*/**',
      '**/.tmp/**',
      '**/*.tsbuildinfo',
      '**/coverage/**',
    ],
  },

  js.configs.recommended,

  ...(STRICT ? tseslint.configs.recommendedTypeChecked : tseslint.configs.recommended),

  {
    files: ['packages/**/{src,scripts}/**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: STRICT
        ? { project: tsProjects, tsconfigRootDir: rootDir }
        : {}, 
    },
    plugins: { '@typescript-eslint': tseslint.plugin, import: importPlugin },
    settings: {
      'import/parsers': { '@typescript-eslint/parser': ['.ts'] },
      'import/resolver': {
        typescript: { project: tsProjects, alwaysTryTypes: true },
        node: { extensions: ['.ts', '.js'] },
      },
    },
    rules: {
      '@typescript-eslint/require-await': 'off',

      ...(STRICT
        ? {
            '@typescript-eslint/no-unsafe-assignment': 'off',
            '@typescript-eslint/no-unsafe-argument': 'off',
            '@typescript-eslint/no-unsafe-member-access': 'off',
            '@typescript-eslint/no-unsafe-return': 'off',
          }
        : {}),
    },
  },

];
