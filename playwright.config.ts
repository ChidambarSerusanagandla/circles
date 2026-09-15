import { defineConfig, devices } from "@playwright/test";
import nextEnv from "@next/env";
import { randomBytes } from "node:crypto";
nextEnv.loadEnvConfig(process.cwd());
process.env.DEMO_INTERNAL_ACCESS_KEY ||= randomBytes(32).toString("hex");
process.env.DEMO_SESSION_SECRET ||= randomBytes(32).toString("hex");
process.env.DEMO_SECURE_COOKIES = "false";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: "http://localhost:3000", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: process.env.PLAYWRIGHT_EXTERNAL_SERVER
    ? undefined
    : {
        command: "npm run start",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 60000,
      },
});
