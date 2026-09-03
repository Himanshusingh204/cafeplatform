"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/guards";
import { permissions } from "@/config/roles";
import { updateReservationStatus } from "@/lib/services/reservations";
import type { ReservationStatus } from "@/lib/generated/prisma/enums";

export interface ActionState {
  ok: boolean;
  error?: string;
}

export async function updateReservationStatusAction(
  id: string,
  status: ReservationStatus,
  notes?: string
): Promise<ActionState> {
  const admin = await requirePermission(permissions.VIEW_MESSAGES);

  try {
    await updateReservationStatus(id, status, notes, admin.id);
    revalidatePath("/admin/reservations");
    revalidatePath("/admin");
    return { ok: true };
  } catch (error) {
    console.error("updateReservationStatusAction error:", error);
    return { ok: false, error: "Failed to update reservation status." };
  }
}
