import { defineConfig, devices } from "@playwright/test";
import nextEnv from "@next/env";
import { randomBytes } from "node:crypto";
nextEnv.loadEnvConfig(process.cwd());
if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true")
  throw new Error(
    "Demo E2E requires an explicitly built NEXT_PUBLIC_DEMO_MODE=true server. Use npm run test:e2e:connected for Supabase.",
  );
process.env.DEMO_INTERNAL_ACCESS_KEY ||= randomBytes(32).toString("hex");
process.env.DEMO_SESSION_SECRET ||= randomBytes(32).toString("hex");
process.env.DEMO_SECURE_COOKIES = "false";
export default defineConfig({
  testDir: "./tests/e2e/demo",
  outputDir: "./test-results/demo",
  globalSetup: "./tests/e2e/mode-check.ts",
  metadata: { mode: "demo" },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["./tests/e2e/safe-reporter.ts"]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer:
    process.env.PLAYWRIGHT_EXTERNAL_SERVER === "true"
      ? undefined
      : {
          command: "npm run start",
          url: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
          reuseExistingServer: false,
          timeout: 60000,
        },
});
