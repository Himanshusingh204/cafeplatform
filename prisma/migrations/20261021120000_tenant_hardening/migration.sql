-- Phase 2 tenant hardening (AUDIT P0-3, P1-7/D1). Expand -> backfill -> constrain.
--
-- 1. Expand: Tenant.taxRatePercent (nullable; NULL = deployment default) and
--    Tenant.currency (default 'INR'). Additive, no table rewrite.
-- 2. Backfill: legacy single-tenant installs have Orders with NULL tenantId.
--    They are assigned to the default tenant 'spice-saffron' (created here only
--    if NULL-tenant orders exist and it is missing).
-- 3. Constrain: Order.tenantId SET NOT NULL; the FK is recreated with
--    ON DELETE RESTRICT so deleting a tenant can never silently erase orders.
-- Other models (Category, Dish, ...) stay nullable: their tenant ownership is
-- not unambiguous for multi-tenant data and is deferred.
--
-- Rollback (manual):
--   ALTER TABLE "Order" ALTER COLUMN "tenantId" DROP NOT NULL;
--   ALTER TABLE "Tenant" DROP COLUMN IF EXISTS "taxRatePercent", DROP COLUMN IF EXISTS "currency";

ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "taxRatePercent" DECIMAL(5,2);
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'INR';

-- Backfill
INSERT INTO "Tenant" ("id", "slug", "name", "subscriptionPlan", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), 'spice-saffron', 'Spice & Saffron Flagship (Hauz Khas)', 'ENTERPRISE', true, NOW(), NOW()
WHERE EXISTS (SELECT 1 FROM "Order" WHERE "tenantId" IS NULL)
  AND NOT EXISTS (SELECT 1 FROM "Tenant" WHERE "slug" = 'spice-saffron');

UPDATE "Order"
SET "tenantId" = (SELECT "id" FROM "Tenant" WHERE "slug" = 'spice-saffron')
WHERE "tenantId" IS NULL;

-- Constrain
ALTER TABLE "Order" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_tenantId_fkey";
ALTER TABLE "Order" ADD CONSTRAINT "Order_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
