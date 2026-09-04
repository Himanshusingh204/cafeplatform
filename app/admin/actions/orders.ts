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
    include: { items: true },
  });

  return raw.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    customerName: o.customerName,
    pickupTime: o.pickupTime,
    specialInstructions: o.specialInstructions,
    total: Number(o.total),
    orderStatus: o.orderStatus,
    createdAt: o.createdAt.toISOString(),
    items: o.items.map((i) => ({
      id: i.id,
      dishName: i.dishName,
      quantity: i.quantity,
      price: Number(i.price),
    })),
  }));
}
