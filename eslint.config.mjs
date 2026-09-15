import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import pluginJs from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import securityPlugin from "eslint-plugin-security";
import prettier from "eslint-plugin-prettier";
import unicorn from "eslint-plugin-unicorn";
import sonarjs from "eslint-plugin-sonarjs";

/** @type {import('eslint').Linter.Config[]} */
export default [
  { files: ["**/*.{js,mjs,cjs,ts,jsx,tsx}"] },
  {
    ignores: [
      ".github/",
      ".husky/",
      "node_modules/",
      ".next/",
      ".next-timeprint/",
      ".next-timeprint-*/",
      "src/components/ui",
      "*.config.ts",
      "**/*.mjs",
      "next-env.d.ts",
    ],
  },
  {
    languageOptions: {
      globals: globals.browser,
      parser: "@typescript-eslint/parser",
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    plugins: {
      security: securityPlugin,
      prettier: prettier,
      unicorn: unicorn,
      sonarjs: sonarjs,
    },
  },
  pluginJs.configs.recommended,
  securityPlugin.configs.recommended,
  ...tseslint.configs.recommended,
  ...nextVitals,
  ...nextTypescript,
  {
    rules: {
      // Prettier integration rules
      "prettier/prettier": "warn",

      // File Naming
      "unicorn/filename-case": [
        "warn",
        {
          case: "kebabCase",
          ignore: ["^.*\\.config\\.(js|ts|mjs)$", "^.*\\.d\\.ts$"],
        },
      ],

      // Custom Rules (Not covered by plugins)
      "spaced-comment": ["warn", "always", { exceptions: ["-", "+"] }],
      "key-spacing": ["warn", { beforeColon: false, afterColon: true }],
      "no-useless-rename": "warn",

      // Import/Export Rules
      "import/no-mutable-exports": "warn",
      "import/order": [
        "warn",
        {
          groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
          pathGroups: [
            {
              pattern: "react",
              group: "external",
              position: "before",
            },
            {
              pattern: "{next,next/**}",
              group: "external",
              position: "before",
            },
          ],
          pathGroupsExcludedImportTypes: [],
          "newlines-between": "always",
          alphabetize: {
            order: "asc",
            caseInsensitive: true,
          },
        },
      ],
      "import/newline-after-import": "warn",
      "import/no-unresolved": [
        "warn",
        {
          caseSensitive: true,
        },
      ],
      "no-duplicate-imports": ["warn", { includeExports: true }],
      "import/no-cycle": ["warn", { maxDepth: 2 }],

      // Whitespace and Punctuation (Style Rules)
      "no-trailing-spaces": "warn",
      "no-multiple-empty-lines": ["warn", { max: 1, maxEOF: 1 }],
      "space-before-function-paren": [
        "warn",
        {
          anonymous: "always",
          named: "never",
          asyncArrow: "always",
        },
      ],
      "space-in-parens": ["warn", "never"],
      "array-bracket-spacing": ["warn", "never"],
      "object-curly-spacing": ["warn", "always"],
      "func-call-spacing": ["warn", "never"],
      "computed-property-spacing": ["warn", "never"],

      // Naming Conventions
      "no-underscore-dangle": ["warn", { allow: ["_id", "__dirname"] }],

      // Complexity
      complexity: ["warn", { max: 3000 }],
      "max-lines": ["warn", { max: 300, skipBlankLines: true, skipComments: true }],
      "max-depth": ["warn", 4],

      // TypeScript-Specific Rules (customized)
      "@typescript-eslint/prefer-nullish-coalescing": "error",
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "@typescript-eslint/no-unnecessary-condition": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn"],

      // React unnecessary import rules
      "react/jsx-no-useless-fragment": ["warn", { allowExpressions: true }],

      // React JSX Pascal Case Rule
      "react/jsx-pascal-case": [
        "warn",
        {
          allowAllCaps: false,
          ignore: [],
        },
      ],

      // React: Prevent nesting component definitions inside another component
      "react/no-unstable-nested-components": ["warn", { allowAsProps: true }],

      // React: Prevent re-renders by ensuring context values are memoized
      "react/jsx-no-constructed-context-values": "warn",

      // React: Disallow array index as key in JSX
      "react/no-array-index-key": "warn",

      // SonarJS: Detect commented-out code
      "sonarjs/no-commented-code": "warn",
    },
  },
];
