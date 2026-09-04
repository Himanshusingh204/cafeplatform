import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/guards";
import { permissions } from "@/config/roles";
import { db } from "@/lib/db/prisma";
import { CouponManager, type AdminCoupon } from "@/components/admin/coupon-manager";

export const metadata: Metadata = {
  title: "Promo Coupons",
};

export const dynamic = "force-dynamic";

export default async function AdminCouponsPage() {
  await requirePermission(permissions.VIEW_MENU);

  const rawCoupons = await db.coupon.findMany({
    orderBy: { createdAt: "desc" },
  });

  const coupons: AdminCoupon[] = rawCoupons.map((c) => ({
    id: c.id,
    code: c.code,
    discountPercent: c.discountPercent,
    minOrder: c.minOrder ? Number(c.minOrder) : null,
    isActive: c.isActive,
    validUntil: c.validUntil ? c.validUntil.toISOString() : null,
    createdAt: c.createdAt.toISOString(),
  }));

  return <CouponManager initialCoupons={coupons} />;
}
