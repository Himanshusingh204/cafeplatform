import "dotenv/config";

import { defineConfig, devices } from "@playwright/test";

import { requireDatabaseUrl, toTestDatabaseUrl } from "./tests/setup/test-db-url";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const testDbUrl = toTestDatabaseUrl(requireDatabaseUrl());

const cleanEnv = Object.fromEntries(
  Object.entries(process.env).filter((entry): entry is [string, string] => Boolean(entry[1]))
);

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  // Serial execution keeps flows deterministic (e.g. the inbox check reads the
  // message submitted by the public suite).
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile-chrome",
      use: {
        viewport: { width: 412, height: 915 },
        hasTouch: true,
        userAgent: devices["Pixel 7"].userAgent,
      },
    },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    // APP_URL must match the served origin so CSRF origin checks accept mutations;
    // rate-limit overrides keep the suite from locking itself out of login/contact.
    env: {
      ...cleanEnv,
      DATABASE_URL: testDbUrl,
      APP_URL: `http://localhost:${PORT}`,
      LOGIN_RATE_MAX: "100",
      CONTACT_RATE_MAX: "50",
    },
  },
});
