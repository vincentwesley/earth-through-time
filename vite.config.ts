import { defineConfig } from "vitest/config";

export default defineConfig({
  // three.js is its own lazily loaded chunk (~135 kB gzipped)
  build: { chunkSizeWarningLimit: 600 },
  test: { include: ["tests/**/*.test.ts"] },
});
