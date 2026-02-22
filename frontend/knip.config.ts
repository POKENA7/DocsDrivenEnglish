import type { KnipConfig } from "knip";

const config: KnipConfig = {
  entry: [
    "src/app/**/*.{ts,tsx}",
    "src/db/client.ts",
    "tests/**/*.test.ts",
    // vitest の server-only エイリアスとして使用
    "tests/shims/**/*.ts",
  ],
  project: ["src/**/*.{ts,tsx}", "tests/**/*.ts"],
  ignoreDependencies: [
    // eslint.config.mjs で FlatCompat 経由の文字列参照のため knip が検知できない
    "eslint-config-next",
    "eslint-config-prettier",
    // Next.js / Tailwind が内部的に要求するが package.json に列挙不要なもの
    "postcss",
    // globals.css 内で @import しているが knip は CSS を解析しない
    "tailwindcss",
    "tw-animate-css",
  ],
};

export default config;
