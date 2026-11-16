import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: [".claude", "dist", "node_modules", "test-results", "playwright-report", "src/credits/credits.js", "public"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
);
