// packages/core/eslint.config.mjs
import tseslint from "typescript-eslint";
import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: [
      "dist/**",
      "coverage/**",
      "schemas/**",
      "**/*.d.ts",
    ],
  },

  js.configs.recommended,
  {
    files: ["**/*.js", "**/*.mjs", "**/*.cjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.node,
    },
  },

  ...tseslint.configs.recommendedTypeChecked.map((cfg) => ({
    ...cfg,
    files: ["src/**/*.ts", "scripts/**/*.ts"],
    languageOptions: {
      ...cfg.languageOptions,
      globals: globals.node,
      parserOptions: {
        project: ["tsconfig.eslint.json"], 
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-floating-promises": [
        "error",
        { ignoreIIFE: true, ignoreVoid: true },
      ],
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: false },
      ],
      "@typescript-eslint/restrict-template-expressions": [
        "warn",
        { allowNumber: true, allowBoolean: true, allowNullish: true, allowAny: true },
      ],
      "@typescript-eslint/require-await": "off",
    },
  })),

  {
    files: ["src/__tests__/**/*.ts", "tests/**/*.ts"],
    languageOptions: {
      globals: {
        ...globals.node, 
        describe: true,
        it: true,
        test: true,
        expect: true,
        beforeAll: true,
        beforeEach: true,
        afterAll: true,
        afterEach: true,
        vi: true,
      },
      parserOptions: {
        project: ["tsconfig.eslint.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-floating-promises": "warn",
      "@typescript-eslint/no-misused-promises": [
        "warn",
        { checksVoidReturn: false },
      ],
      "no-console": "off",
    },
  },

  {
    files: ["scripts/**/*.ts"],
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        project: ["tsconfig.eslint.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "no-console": "off",
    },
  },
];
