import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./test/setup.js"],
    // each file gets its own in-memory MongoDB; starting one can take a few seconds
    hookTimeout: 120000,
    testTimeout: 30000
  }
});
