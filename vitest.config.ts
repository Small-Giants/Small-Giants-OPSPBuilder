import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // The rules suite shares a single emulator instance and clears it between
    // cases, so files must not run in parallel.
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
