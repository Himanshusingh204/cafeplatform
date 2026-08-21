import { execSync } from "node:child_process";
import { Client } from "pg";

import {
  TEST_DB_NAME,
  requireDatabaseUrl,
  toAdminDatabaseUrl,
  toTestDatabaseUrl,
} from "./test-db-url";

export default async function globalSetup() {
  const sourceUrl = requireDatabaseUrl();

  const admin = new Client({ connectionString: toAdminDatabaseUrl(sourceUrl) });
  try {
    await admin.connect();
    const existing = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [
      TEST_DB_NAME,
    ]);
    if (existing.rowCount === 0) {
      // Identifier comes from the constant above, never from user input.
      await admin.query(`CREATE DATABASE "${TEST_DB_NAME}"`);
    }
  } finally {
    await admin.end();
  }

  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: toTestDatabaseUrl(sourceUrl) },
  });
}
