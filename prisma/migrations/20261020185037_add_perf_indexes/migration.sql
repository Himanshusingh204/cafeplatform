-- Performance indexes (AUDIT P2-1, P2-2, P2-3).
--
-- Serves, in order:
--   * Dish        — hot per-category menu read:
--                   WHERE "categoryId" = ? AND "isAvailable" = true
--                     AND "deletedAt" IS NULL ORDER BY "sortOrder"
--   * Category    — active-menu category list:
--                   WHERE "isActive" = true AND "deletedAt" IS NULL ORDER BY "sortOrder"
--   * Order       — Orders API: tenant-scoped list, optional status filter,
--                   ORDER BY "createdAt" DESC (with and without the status filter)
--   * ContactMessage — admin inbox: WHERE "status" = ? ORDER BY "createdAt" DESC
--   * ActivityLog — per-entity audit view, newest-first
--   * LoyaltyLedger — customer statement, newest-first
--   * WaitlistEntry — live queue board: WHERE "tenantId" = ? AND "status" = ?
--                     ORDER BY "createdAt"
--
-- The matching single-column indexes that a composite's leftmost prefix already
-- covers are dropped below, together with indexes that merely duplicated a
-- @unique constraint's B-tree.
--
-- LIMITATIONS (deliberate, documented):
--   * Prisma cannot express a partial index (`WHERE "deletedAt" IS NULL`) or
--     CONCURRENTLY. "Dish_categoryId_isAvailable_deletedAt_sortOrder_idx" and
--     "Category_isActive_deletedAt_sortOrder_idx" are therefore full indexes.
--     If the hand-written partial indexes in docs/DATABASE.md §4.7 are created,
--     drop these composites in the same change — do not ship both.
--   * On a large/hot production table, create the new indexes with
--     `CREATE INDEX CONCURRENTLY` outside a transaction (Prisma wraps a
--     migration in a transaction, so it cannot do this for you). This migration
--     is written idempotently so that a hand-run CONCURRENTLY variant is safe.
--
-- Every statement is idempotent (IF NOT EXISTS / IF EXISTS); re-running is a no-op.
-- Rollback: see the block at the end of this file.

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Dish_categoryId_isAvailable_deletedAt_sortOrder_idx" ON "Dish"("categoryId", "isAvailable", "deletedAt", "sortOrder");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Category_isActive_deletedAt_sortOrder_idx" ON "Category"("isActive", "deletedAt", "sortOrder");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Order_tenantId_orderStatus_createdAt_idx" ON "Order"("tenantId", "orderStatus", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Order_tenantId_createdAt_idx" ON "Order"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ContactMessage_status_createdAt_idx" ON "ContactMessage"("status", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ActivityLog_entityType_entityId_createdAt_idx" ON "ActivityLog"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LoyaltyLedger_customerId_createdAt_idx" ON "LoyaltyLedger"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WaitlistEntry_tenantId_status_createdAt_idx" ON "WaitlistEntry"("tenantId", "status", "createdAt");

-- DropIndex — duplicated a @unique B-tree (Tenant.slug, Admin.email, Dish.slug,
-- Coupon.code, ApiKey.keyHash, Reservation.referenceCode, CustomerUser.email).
DROP INDEX IF EXISTS "Tenant_slug_idx";
DROP INDEX IF EXISTS "Tenant_customDomain_idx";
DROP INDEX IF EXISTS "Admin_email_idx";
DROP INDEX IF EXISTS "Dish_slug_idx";
DROP INDEX IF EXISTS "Coupon_code_idx";
DROP INDEX IF EXISTS "ApiKey_keyHash_idx";
DROP INDEX IF EXISTS "Reservation_referenceCode_idx";
DROP INDEX IF EXISTS "CustomerUser_email_idx";

-- DropIndex — leftmost prefix of a composite created above.
DROP INDEX IF EXISTS "Dish_categoryId_idx";
DROP INDEX IF EXISTS "Category_isActive_idx";
DROP INDEX IF EXISTS "Order_tenantId_idx";
DROP INDEX IF EXISTS "ContactMessage_status_idx";
DROP INDEX IF EXISTS "WaitlistEntry_tenantId_idx";
DROP INDEX IF EXISTS "LoyaltyLedger_customerId_idx";

-- DropIndex — replaced by ("entityType", "entityId", "createdAt"); the two-column
-- prefix is identical, so the three-column index serves both shapes.
DROP INDEX IF EXISTS "ActivityLog_entityType_entityId_idx";


-- ============================================================================
-- Rollback (manual — this repo has no down migrations)
-- ============================================================================
-- Run the whole block to restore the pre-migration index set exactly.
--
-- Drop the composites added above:
-- DROP INDEX IF EXISTS "Dish_categoryId_isAvailable_deletedAt_sortOrder_idx";
-- DROP INDEX IF EXISTS "Category_isActive_deletedAt_sortOrder_idx";
-- DROP INDEX IF EXISTS "Order_tenantId_orderStatus_createdAt_idx";
-- DROP INDEX IF EXISTS "Order_tenantId_createdAt_idx";
-- DROP INDEX IF EXISTS "ContactMessage_status_createdAt_idx";
-- DROP INDEX IF EXISTS "ActivityLog_entityType_entityId_createdAt_idx";
-- DROP INDEX IF EXISTS "LoyaltyLedger_customerId_createdAt_idx";
-- DROP INDEX IF EXISTS "WaitlistEntry_tenantId_status_createdAt_idx";
--
-- Restore the single-column indexes:
-- CREATE INDEX IF NOT EXISTS "Tenant_slug_idx" ON "Tenant"("slug");
-- CREATE INDEX IF NOT EXISTS "Tenant_customDomain_idx" ON "Tenant"("customDomain");
-- CREATE INDEX IF NOT EXISTS "Admin_email_idx" ON "Admin"("email");
-- CREATE INDEX IF NOT EXISTS "Dish_slug_idx" ON "Dish"("slug");
-- CREATE INDEX IF NOT EXISTS "Coupon_code_idx" ON "Coupon"("code");
-- CREATE INDEX IF NOT EXISTS "ApiKey_keyHash_idx" ON "ApiKey"("keyHash");
-- CREATE INDEX IF NOT EXISTS "Reservation_referenceCode_idx" ON "Reservation"("referenceCode");
-- CREATE INDEX IF NOT EXISTS "CustomerUser_email_idx" ON "CustomerUser"("email");
-- CREATE INDEX IF NOT EXISTS "Dish_categoryId_idx" ON "Dish"("categoryId");
-- CREATE INDEX IF NOT EXISTS "Category_isActive_idx" ON "Category"("isActive");
-- CREATE INDEX IF NOT EXISTS "Order_tenantId_idx" ON "Order"("tenantId");
-- CREATE INDEX IF NOT EXISTS "ContactMessage_status_idx" ON "ContactMessage"("status");
-- CREATE INDEX IF NOT EXISTS "WaitlistEntry_tenantId_idx" ON "WaitlistEntry"("tenantId");
-- CREATE INDEX IF NOT EXISTS "LoyaltyLedger_customerId_idx" ON "LoyaltyLedger"("customerId");
-- CREATE INDEX IF NOT EXISTS "ActivityLog_entityType_entityId_idx" ON "ActivityLog"("entityType", "entityId");
--
-- Then remove the migration row so `prisma migrate` re-plans it:
-- DELETE FROM "_prisma_migrations" WHERE migration_name = '20261020185037_add_perf_indexes';
-- ============================================================================
