import { execSync } from "node:child_process";

import "dotenv/config";

import { requireDatabaseUrl, toTestDatabaseUrl } from "../setup/test-db-url";

// Prepares the isolated e2e database. Dev data is never touched: the server
// under test is started with DATABASE_URL pointed at the test database.
export default function globalSetup() {
  const testDbUrl = toTestDatabaseUrl(requireDatabaseUrl());
  const env = { ...process.env, DATABASE_URL: testDbUrl };

  execSync("npx prisma migrate deploy", { env, stdio: "inherit" });
  execSync("npx prisma db seed", { env, stdio: "inherit" });
}
