import path from "node:path";
import { fileURLToPath } from "node:url";

import { FlatCompat } from "@eslint/eslintrc";
import { defineConfig, globalIgnores } from "eslint/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = defineConfig([
  ...compat.extends("next/core-web-vitals", "next/typescript", "prettier"),

  // feature 間の直接 import を禁止し、@/server/* を経由させる
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/app/(features)/history/**", "@/app/(features)/review-queue/**"],
              message: "feature 間の直接 import は禁止。@/server/* を使うこと。",
            },
          ],
        },
      ],
    },
  },

  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",

    // Project-specific build outputs:
    "dist/**",
    "coverage/**",
    ".open-next/**",
    ".wrangler/**",
  ]),
]);

export default eslintConfig;
