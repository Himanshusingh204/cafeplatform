import { execSync } from "node:child_process";
import { Client } from "pg";
import "dotenv/config";

import {
  TEST_DB_NAME,
  requireDatabaseUrl,
  toAdminDatabaseUrl,
  toTestDatabaseUrl,
} from "../setup/test-db-url";

// Prepares the isolated e2e database. Dev data is never touched: the server
// under test is started with DATABASE_URL pointed at the test database.
export default async function globalSetup() {
  const sourceUrl = requireDatabaseUrl();

  const admin = new Client({ connectionString: toAdminDatabaseUrl(sourceUrl) });
  try {
    await admin.connect();
    const existing = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [
      TEST_DB_NAME,
    ]);
    if (existing.rowCount === 0) {
      await admin.query(`CREATE DATABASE "${TEST_DB_NAME}"`);
    }
  } finally {
    await admin.end();
  }

  const testDbUrl = toTestDatabaseUrl(sourceUrl);
  const env = { ...process.env, DATABASE_URL: testDbUrl, SEED_DEMO_DATA: "true" };

  execSync("npx prisma migrate deploy", { env, stdio: "inherit" });
  execSync("npx prisma db seed", { env, stdio: "inherit" });
}
