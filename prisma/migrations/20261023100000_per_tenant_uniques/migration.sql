-- AUDIT P2-5: uniqueness is per tenant, not global.
-- Category.slug, Dish.slug, Coupon.code and Setting.key become unique within a tenant.
-- Safe on existing data: a globally unique column is trivially unique per tenant.
-- Admin.email, Order.orderNumber and CustomerUser.email intentionally stay global.
--
-- Rollback (manual): drop the *_tenantId_*_key indexes and recreate the single-column ones;
-- this fails if two tenants already share a value.

DROP INDEX IF EXISTS "Category_slug_key";
DROP INDEX IF EXISTS "Dish_slug_key";
DROP INDEX IF EXISTS "Coupon_code_key";
DROP INDEX IF EXISTS "Setting_key_key";

CREATE UNIQUE INDEX "Category_tenantId_slug_key" ON "Category"("tenantId", "slug");
CREATE UNIQUE INDEX "Dish_tenantId_slug_key"     ON "Dish"("tenantId", "slug");
CREATE UNIQUE INDEX "Coupon_tenantId_code_key"   ON "Coupon"("tenantId", "code");
CREATE UNIQUE INDEX "Setting_tenantId_key_key"   ON "Setting"("tenantId", "key");
