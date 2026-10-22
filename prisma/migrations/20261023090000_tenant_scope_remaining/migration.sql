-- AUDIT P2-4: tenant-scope the remaining tenant-owned tables. Expand -> backfill -> constrain.
--
-- GalleryImage, ContactMessage, Review, Setting, Coupon gain tenantId (new, NOT NULL).
-- Category and Dish already had a nullable tenantId; it becomes NOT NULL too, because
-- the per-tenant slug uniqueness added in the next migration is meaningless over NULLs
-- (Postgres treats NULLs as distinct in unique indexes).
-- Every FK is ON DELETE RESTRICT: deleting a tenant must never silently erase its data.
--
-- Backfill: rows without an owner are assigned to the default tenant 'spice-saffron',
-- created here only when such rows exist and the tenant is missing (as 20261021120000 did).
--
-- Rollback (manual): ALTER TABLE ... DROP COLUMN "tenantId" on the five new tables;
--   ALTER TABLE "Category"/"Dish" ALTER COLUMN "tenantId" DROP NOT NULL.

-- Expand
ALTER TABLE "GalleryImage"   ADD COLUMN IF NOT EXISTS "tenantId" UUID;
ALTER TABLE "ContactMessage" ADD COLUMN IF NOT EXISTS "tenantId" UUID;
ALTER TABLE "Review"         ADD COLUMN IF NOT EXISTS "tenantId" UUID;
ALTER TABLE "Setting"        ADD COLUMN IF NOT EXISTS "tenantId" UUID;
ALTER TABLE "Coupon"         ADD COLUMN IF NOT EXISTS "tenantId" UUID;

-- Backfill: ensure the default tenant exists only if some row needs it.
INSERT INTO "Tenant" ("id", "slug", "name", "subscriptionPlan", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), 'spice-saffron', 'Spice & Saffron Flagship (Hauz Khas)', 'ENTERPRISE', true, NOW(), NOW()
WHERE (
       EXISTS (SELECT 1 FROM "GalleryImage"   WHERE "tenantId" IS NULL)
    OR EXISTS (SELECT 1 FROM "ContactMessage" WHERE "tenantId" IS NULL)
    OR EXISTS (SELECT 1 FROM "Review"         WHERE "tenantId" IS NULL)
    OR EXISTS (SELECT 1 FROM "Setting"        WHERE "tenantId" IS NULL)
    OR EXISTS (SELECT 1 FROM "Coupon"         WHERE "tenantId" IS NULL)
    OR EXISTS (SELECT 1 FROM "Category"       WHERE "tenantId" IS NULL)
    OR EXISTS (SELECT 1 FROM "Dish"           WHERE "tenantId" IS NULL)
  )
  AND NOT EXISTS (SELECT 1 FROM "Tenant" WHERE "slug" = 'spice-saffron');

UPDATE "GalleryImage"   SET "tenantId" = (SELECT "id" FROM "Tenant" WHERE "slug" = 'spice-saffron') WHERE "tenantId" IS NULL;
UPDATE "ContactMessage" SET "tenantId" = (SELECT "id" FROM "Tenant" WHERE "slug" = 'spice-saffron') WHERE "tenantId" IS NULL;
UPDATE "Review"         SET "tenantId" = (SELECT "id" FROM "Tenant" WHERE "slug" = 'spice-saffron') WHERE "tenantId" IS NULL;
UPDATE "Setting"        SET "tenantId" = (SELECT "id" FROM "Tenant" WHERE "slug" = 'spice-saffron') WHERE "tenantId" IS NULL;
UPDATE "Coupon"         SET "tenantId" = (SELECT "id" FROM "Tenant" WHERE "slug" = 'spice-saffron') WHERE "tenantId" IS NULL;
UPDATE "Category"       SET "tenantId" = (SELECT "id" FROM "Tenant" WHERE "slug" = 'spice-saffron') WHERE "tenantId" IS NULL;
UPDATE "Dish"           SET "tenantId" = (SELECT "id" FROM "Tenant" WHERE "slug" = 'spice-saffron') WHERE "tenantId" IS NULL;

-- Constrain
ALTER TABLE "GalleryImage"   ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "ContactMessage" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Review"         ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Setting"        ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Coupon"         ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Category"       ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Dish"           ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "Category" DROP CONSTRAINT IF EXISTS "Category_tenantId_fkey";
ALTER TABLE "Dish"     DROP CONSTRAINT IF EXISTS "Dish_tenantId_fkey";

ALTER TABLE "GalleryImage"   ADD CONSTRAINT "GalleryImage_tenantId_fkey"   FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ContactMessage" ADD CONSTRAINT "ContactMessage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Review"         ADD CONSTRAINT "Review_tenantId_fkey"         FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Setting"        ADD CONSTRAINT "Setting_tenantId_fkey"        FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Coupon"         ADD CONSTRAINT "Coupon_tenantId_fkey"         FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Category"       ADD CONSTRAINT "Category_tenantId_fkey"       FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Dish"           ADD CONSTRAINT "Dish_tenantId_fkey"           FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "GalleryImage_tenantId_idx"   ON "GalleryImage"("tenantId");
CREATE INDEX IF NOT EXISTS "ContactMessage_tenantId_idx" ON "ContactMessage"("tenantId");
CREATE INDEX IF NOT EXISTS "Review_tenantId_idx"         ON "Review"("tenantId");
