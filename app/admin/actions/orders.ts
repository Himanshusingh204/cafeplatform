"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/guards";
import { permissions } from "@/config/roles";
import { updateOrderStatus } from "@/lib/services/orders";
import { db } from "@/lib/db/prisma";
import type { OrderStatus } from "@/lib/generated/prisma/enums";

export interface ActionState {
  ok: boolean;
  error?: string;
}

export async function updateOrderStatusAction(
  id: string,
  status: OrderStatus
): Promise<ActionState> {
  const admin = await requirePermission(permissions.VIEW_MENU);

  try {
    await updateOrderStatus(id, status, admin.id);
    revalidatePath("/admin/orders");
    revalidatePath("/admin");
    return { ok: true };
  } catch (error) {
    console.error("updateOrderStatusAction error:", error);
    return { ok: false, error: "Failed to update order status." };
  }
}

export async function getActiveKDSOrdersAction() {
  await requirePermission(permissions.VIEW_MENU);

  const raw = await db.order.findMany({
    where: {
      orderStatus: {
        in: ["PENDING", "CONFIRMED", "PREPARING", "READY", "COMPLETED"],
      },
    },
    orderBy: { createdAt: "desc" },
    take: 40,
    include: {
      items: {
        include: {
          modifiers: true,
        },
      },
    },
  });

  return raw.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    customerName: o.customerName,
    pickupTime: o.pickupTime,
    diningMode: o.diningMode,
    tableNumber: o.tableNumber,
    tip: Number(o.tip),
    specialInstructions: o.specialInstructions,
    total: Number(o.total),
    orderStatus: o.orderStatus,
    createdAt: o.createdAt.toISOString(),
    items: o.items.map((i) => ({
      id: i.id,
      dishName: i.dishName,
      quantity: i.quantity,
      price: Number(i.price),
      station: i.station,
      isCompleted: i.isCompleted,
      modifiers: i.modifiers.map((m) => ({
        groupName: m.groupName,
        optionName: m.optionName,
        priceDelta: Number(m.priceDelta),
      })),
    })),
  }));
}

export async function adminBumpOrderItemAction(
  orderItemId: string,
  isCompleted: boolean
): Promise<ActionState> {
  await requirePermission(permissions.VIEW_MENU);

  try {
    const { updateOrderItemCompletion } = await import("@/lib/services/orders");
    await updateOrderItemCompletion(orderItemId, isCompleted);
    revalidatePath("/admin/orders");
    return { ok: true };
  } catch (error) {
    console.error("adminBumpOrderItemAction error:", error);
    return { ok: false, error: "Failed to bump order item." };
  }
}
