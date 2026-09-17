import { defineConfig, devices } from "@playwright/test";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());
if (process.env.NEXT_PUBLIC_DEMO_MODE !== "false")
  throw new Error(
    "Connected E2E requires NEXT_PUBLIC_DEMO_MODE=false and a connected build.",
  );
for (const name of [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SEED_PASSWORD",
  "SEED_INTERNAL_PASSWORD",
  "SUPABASE_SERVICE_ROLE_KEY",
  "ANALYTICS_COOKIE_SECRET",
  "E2E_SUPABASE_PROJECT_REF",
])
  if (!process.env[name])
    throw new Error(
      `Connected E2E requires ${name} in the private environment.`,
    );

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
export default defineConfig({
  testDir: "./tests/e2e/connected",
  outputDir: "./test-results/connected",
  globalSetup: "./tests/e2e/connected/setup.ts",
  metadata: { mode: "connected" },
  // These accounts share a real database; parallel runs would race mutations.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [["./tests/e2e/safe-reporter.ts"]],
  use: {
    baseURL,
    actionTimeout: 20_000,
    navigationTimeout: 60_000,
    // Auth request bodies and session headers must not be stored in traces.
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
          // Startup polling must not create unjournaled analytics visitors.
          url: new URL("/icon.svg", baseURL).href,
          reuseExistingServer: false,
          timeout: 60_000,
        },
});
