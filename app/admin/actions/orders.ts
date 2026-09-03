"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/guards";
import { permissions } from "@/config/roles";
import { updateOrderStatus } from "@/lib/services/orders";
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
