"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/guards";
import { permissions } from "@/config/roles";
import { db } from "@/lib/db/prisma";
import { getAdminTenantId } from "@/lib/auth/tenant-context";

export interface ActionState<T = unknown> {
  ok: boolean;
  error?: string;
  data?: T;
}

export async function listCouponsAction() {
  const admin = await requirePermission(permissions.VIEW_MENU);

  try {
    const tenantId = await getAdminTenantId(admin);
    const coupons = await db.coupon.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });

    return {
      ok: true,
      data: coupons.map((c) => ({
        id: c.id,
        code: c.code,
        discountPercent: c.discountPercent,
        minOrder: c.minOrder ? Number(c.minOrder) : null,
        isActive: c.isActive,
        validUntil: c.validUntil ? c.validUntil.toISOString() : null,
        createdAt: c.createdAt.toISOString(),
      })),
    };
  } catch (error) {
    console.error("listCouponsAction error:", error);
    return { ok: false, error: "Failed to load coupons." };
  }
}

export async function createCouponAction(input: {
  code: string;
  discountPercent: number;
  minOrder?: number | null;
  validUntil?: string | null;
  isActive?: boolean;
}): Promise<ActionState> {
  const admin = await requirePermission(permissions.EDIT_MENU);

  const cleanCode = input.code.trim().toUpperCase();
  if (!cleanCode || cleanCode.length < 3) {
    return { ok: false, error: "Coupon code must be at least 3 characters." };
  }

  if (input.discountPercent < 1 || input.discountPercent > 100) {
    return { ok: false, error: "Discount percentage must be between 1% and 100%." };
  }

  try {
    const tenantId = await getAdminTenantId(admin);
    const existing = await db.coupon.findUnique({
      where: { tenantId_code: { tenantId, code: cleanCode } },
    });
    if (existing) {
      return { ok: false, error: `Coupon code '${cleanCode}' already exists.` };
    }

    await db.coupon.create({
      data: {
        tenantId,
        code: cleanCode,
        discountPercent: input.discountPercent,
        minOrder: input.minOrder ? input.minOrder : null,
        validUntil: input.validUntil ? new Date(input.validUntil) : null,
        isActive: input.isActive ?? true,
      },
    });

    revalidatePath("/admin/coupons");
    return { ok: true };
  } catch (error) {
    console.error("createCouponAction error:", error);
    return { ok: false, error: "Failed to create coupon." };
  }
}

export async function toggleCouponAction(id: string, isActive: boolean): Promise<ActionState> {
  const admin = await requirePermission(permissions.EDIT_MENU);

  try {
    const tenantId = await getAdminTenantId(admin);
    const { count } = await db.coupon.updateMany({
      where: { id, tenantId },
      data: { isActive },
    });
    if (count === 0) return { ok: false, error: "Coupon not found." };

    revalidatePath("/admin/coupons");
    return { ok: true };
  } catch (error) {
    console.error("toggleCouponAction error:", error);
    return { ok: false, error: "Failed to update coupon status." };
  }
}

export async function deleteCouponAction(id: string): Promise<ActionState> {
  const admin = await requirePermission(permissions.DELETE_MENU);

  try {
    const tenantId = await getAdminTenantId(admin);
    const { count } = await db.coupon.deleteMany({ where: { id, tenantId } });
    if (count === 0) return { ok: false, error: "Coupon not found." };
    revalidatePath("/admin/coupons");
    return { ok: true };
  } catch (error) {
    console.error("deleteCouponAction error:", error);
    return { ok: false, error: "Failed to delete coupon." };
  }
}
