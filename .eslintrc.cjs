/* eslint-disable no-undef */
module.exports = {
  root: true,
  env: { es2022: true, node: true },
  ignorePatterns: ['**/node_modules/**', '**/dist/**', '**/coverage/**'],
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
      files: ['**/*.ts', '**/*.tsx'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      rules: {},
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
  ],
  settings: {
    'import/resolver': {
      typescript: { project: ['./packages/*/tsconfig.json'] },
      node: { extensions: ['.ts', '.tsx', '.js', '.mjs'] },
    },
  },
};
