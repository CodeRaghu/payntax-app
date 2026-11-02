import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "public/mockServiceWorker.js",
    "src/api/schema.d.ts",
    "playwright-report/**",
    "test-results/**",
  ]),
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_", ignoreRestSiblings: true }],
      // Screens reach the backend only through src/api (keeps UI and API independent).
      "no-restricted-globals": ["error", { name: "fetch", message: "Use the typed client in src/api instead of fetch()." }],
    },
  },
  {
    files: ["src/api/**", "src/mocks/**", "**/*.test.ts", "**/*.test.tsx", "e2e/**"],
    rules: { "no-restricted-globals": "off" },
  },
]);

export default eslintConfig;
