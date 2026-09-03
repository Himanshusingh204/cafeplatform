import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

import "dotenv/config";
import { requireDatabaseUrl, toTestDatabaseUrl } from "./tests/setup/test-db-url";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "tests/e2e/**"],
    // Suites share one test database, so files must not truncate concurrently.
    fileParallelism: false,
    globalSetup: "./tests/setup/global-setup.ts",
    env: {
      DATABASE_URL: toTestDatabaseUrl(requireDatabaseUrl()),
      NODE_ENV: "test",
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/setup/server-only-stub.ts", import.meta.url)),
    },
  },
});
