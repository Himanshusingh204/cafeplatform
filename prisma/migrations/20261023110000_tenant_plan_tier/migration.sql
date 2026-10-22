-- Phase 9 slice: quota tier per tenant. Additive; default STARTER.
-- Limits live in lib/plans/index.ts (code, not data), so tuning a limit needs no migration.
-- Rollback (manual): ALTER TABLE "Tenant" DROP COLUMN "plan"; DROP TYPE "PlanTier";

CREATE TYPE "PlanTier" AS ENUM ('FREE', 'STARTER', 'PRO');

ALTER TABLE "Tenant" ADD COLUMN "plan" "PlanTier" NOT NULL DEFAULT 'STARTER';
