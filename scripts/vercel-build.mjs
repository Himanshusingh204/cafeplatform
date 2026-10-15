#!/usr/bin/env node

/**
 * Vercel build entrypoint.
 *
 * `vercel.json` points its `buildCommand` here instead of running
 * `prisma migrate deploy && next build` inline, because the migration step must
 * not run for every deployment.
 *
 * `prisma migrate deploy` applies pending migrations to whatever `DATABASE_URL`
 * points at. Preview deployments frequently inherit the production connection
 * string, so an inline migration means "merge a branch, migrate production".
 * This script applies migrations for production builds only.
 *
 * Decision table (`--check` prints it without doing anything):
 *
 *   VERCEL_ENV=production  -> migrate + build
 *   VERCEL_ENV=preview     -> build only
 *   VERCEL_ENV=development -> build only
 *   VERCEL_ENV unset       -> migrate + build  (local and CI keep today's behaviour)
 *
 * Usage:
 *   node scripts/vercel-build.mjs            # migrate (unless preview/dev) + build
 *   node scripts/vercel-build.mjs --check    # print the plan and exit
 */

import { execSync } from "node:child_process";

const PREVIEW_LIKE_ENVIRONMENTS = ["preview", "development"];

const vercelEnv = process.env.VERCEL_ENV?.trim() || "";
const shouldMigrate = !PREVIEW_LIKE_ENVIRONMENTS.includes(vercelEnv);
const checkOnly = process.argv.includes("--check");

function describePlan() {
  const where = vercelEnv ? `VERCEL_ENV=${vercelEnv}` : "VERCEL_ENV unset";
  return [
    `Build plan (${where}):`,
    `  prisma migrate deploy : ${shouldMigrate ? "RUN" : "skip (non-production deployment)"}`,
    `  next build            : RUN`,
  ].join("\n");
}

function run(command) {
  console.log(`\n$ ${command}`);
  execSync(command, { stdio: "inherit" });
}

if (checkOnly) {
  console.log(describePlan());
  process.exit(0);
}

console.log(describePlan());

if (shouldMigrate) {
  if (!process.env.DATABASE_URL) {
    console.error("\nDATABASE_URL is required to apply migrations. Refusing to build.");
    process.exit(1);
  }

  try {
    run("npx prisma migrate deploy");
  } catch {
    // Migrations are part of the build contract: a failed migration must fail
    // the deployment rather than ship code against an unmigrated database.
    console.error("\nprisma migrate deploy failed. Aborting the build.");
    process.exit(1);
  }
} else {
  console.log("\nSkipping migrations: this is not a production deployment.");
}

try {
  run("npx next build");
} catch {
  console.error("\nnext build failed.");
  process.exit(1);
}
