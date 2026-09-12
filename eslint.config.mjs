import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "dist/**",
      "out/**",
      "build/**",
      "prisma/migrations/**",
      "contracts/openapi/**",
      "tests/architecture/fixtures/**",
      "src/generated/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "no-console": ["warn", { allow: ["warn", "error", "log"] }],
    },
  },
  {
    files: ["scripts/**/*.{ts,mjs,cjs,js}", "*.cjs", "*.mjs"],
    rules: {
      "no-console": "off",
    },
  },
  {
    files: ["src/worker/**/*.{ts,tsx}"],
    rules: {
      "no-console": "off",
    },
  },
];
