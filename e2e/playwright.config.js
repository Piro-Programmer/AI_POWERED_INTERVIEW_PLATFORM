import { defineConfig, devices } from "@playwright/test";

const API_PORT = 3100;
const WEB_PORT = 4180; // not vite preview's default, so a leftover preview is never reused
const isCI = Boolean(process.env.CI);

// End-to-end: a real browser against the production frontend build, which
// proxies /api to the real backend (in-memory MongoDB, fake AI).
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  // channel "chromium": full Chromium in its new headless mode (closest to a
  // real browser), so the separate headless-shell download isn't needed.
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], channel: "chromium" } }],
  webServer: [
    {
      command: "node server/start-backend.mjs",
      env: { E2E_API_PORT: String(API_PORT) },
      url: `http://localhost:${API_PORT}/api/health`,
      // always fresh: rate-limit counters and data live only as long as the server
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: "pipe"
    },
    {
      command: `npx vite build && npx vite preview --port ${WEB_PORT} --strictPort`,
      cwd: "../Frontend",
      env: { API_PROXY_TARGET: `http://localhost:${API_PORT}` },
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: false,
      timeout: 120_000
    }
  ]
});
