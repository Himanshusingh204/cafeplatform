import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requirePermission,
  updateOrderStatus,
  updateOrderItemCompletion,
  updateReservationStatus,
  moderateReview,
  deleteReview,
} = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  updateOrderStatus: vi.fn(),
  updateOrderItemCompletion: vi.fn(),
  updateReservationStatus: vi.fn(),
  moderateReview: vi.fn(),
  deleteReview: vi.fn(),
}));

vi.mock("@/lib/auth/guards", () => ({ requirePermission }));
vi.mock("@/lib/auth/tenant-context", () => ({ getAdminTenantId: vi.fn().mockResolvedValue("tenant-1") }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("@/lib/services/orders", () => ({ updateOrderStatus, updateOrderItemCompletion }));
vi.mock("@/lib/services/reservations", () => ({ updateReservationStatus }));
vi.mock("@/lib/services/reviews", () => ({ moderateReview, deleteReview }));
vi.mock("@/lib/db/prisma", () => ({
  db: { order: { findMany: vi.fn().mockResolvedValue([]) } },
}));

import { hasPermission, permissions, type Permission } from "@/config/roles";
import type { AdminRole } from "@/lib/generated/prisma/enums";
import {
  adminBumpOrderItemAction,
  getActiveKDSOrdersAction,
  updateOrderStatusAction,
} from "@/app/admin/actions/orders";
import { updateReservationStatusAction } from "@/app/admin/actions/reservations";
import { deleteReviewAction, moderateReviewAction } from "@/app/admin/actions/reviews";

const ADMIN = { id: "admin-1", role: "ADMIN" };
const EDITOR = { id: "editor-1", role: "EDITOR" };

describe("operational permissions matrix", () => {
  it("grants order/reservation/review management to SUPER_ADMIN and ADMIN only", () => {
    for (const permission of [
      permissions.MANAGE_ORDERS,
      permissions.MANAGE_RESERVATIONS,
      permissions.MODERATE_REVIEWS,
    ] as const) {
      expect(hasPermission("SUPER_ADMIN" as AdminRole, permission)).toBe(true);
      expect(hasPermission("ADMIN" as AdminRole, permission)).toBe(true);
      expect(hasPermission("EDITOR" as AdminRole, permission)).toBe(false);
    }
  });

  it("keeps read-only access for EDITOR", () => {
    expect(hasPermission("EDITOR" as AdminRole, permissions.VIEW_MENU)).toBe(true);
    expect(hasPermission("EDITOR" as AdminRole, permissions.VIEW_MESSAGES)).toBe(true);
  });
});

describe("admin mutations require operational permissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requirePermission.mockResolvedValue(ADMIN);
  });

  it("order status, KDS bump and KDS listing all require MANAGE_ORDERS", async () => {
    await updateOrderStatusAction("order-1", "PREPARING");
    await adminBumpOrderItemAction("item-1", true);
    await getActiveKDSOrdersAction();

    expect(requirePermission).toHaveBeenCalledTimes(3);
    for (const call of requirePermission.mock.calls) {
      expect(call[0]).toBe(permissions.MANAGE_ORDERS);
    }
  });

  it("reservation status requires MANAGE_RESERVATIONS", async () => {
    await updateReservationStatusAction("res-1", "CONFIRMED");
    expect(requirePermission).toHaveBeenCalledWith(permissions.MANAGE_RESERVATIONS);
    expect(updateReservationStatus).toHaveBeenCalled();
  });

  it("review moderation and deletion require MODERATE_REVIEWS", async () => {
    await moderateReviewAction("review-1", { isApproved: true });
    await deleteReviewAction("review-1");
    expect(requirePermission).toHaveBeenCalledTimes(2);
    for (const call of requirePermission.mock.calls) {
      expect(call[0]).toBe(permissions.MODERATE_REVIEWS);
    }
    expect(moderateReview).toHaveBeenCalled();
    expect(deleteReview).toHaveBeenCalled();
  });

  it("an EDITOR is blocked before the service layer runs", async () => {
    requirePermission.mockImplementation((permission: Permission) => {
      if (!hasPermission(EDITOR.role as AdminRole, permission)) {
        throw new Error("NEXT_NOT_FOUND");
      }
      return EDITOR;
    });

    await expect(updateOrderStatusAction("order-1", "PREPARING")).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(updateReservationStatusAction("res-1", "CONFIRMED")).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(moderateReviewAction("review-1", { isApproved: true })).rejects.toThrow("NEXT_NOT_FOUND");

    expect(updateOrderStatus).not.toHaveBeenCalled();
    expect(updateReservationStatus).not.toHaveBeenCalled();
    expect(moderateReview).not.toHaveBeenCalled();
  });
});
