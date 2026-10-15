"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/guards";
import { permissions } from "@/config/roles";
import {
  addToWaitlist,
  notifyParty,
  seatParty,
  cancelWaitlistEntry,
} from "@/lib/services/waitlist";

export interface ActionState {
  ok: boolean;
  error?: string;
  entryId?: string;
}

export async function adminAddToWaitlistAction(formData: FormData): Promise<ActionState> {
  await requirePermission(permissions.VIEW_MENU);

  try {
    const customerName = String(formData.get("customerName") || "").trim();
    const customerPhone = String(formData.get("customerPhone") || "").trim();
    const partySize = Number(formData.get("partySize") || 2);
    const specialNotes = formData.get("specialNotes")
      ? String(formData.get("specialNotes")).trim()
      : undefined;

    if (!customerName || !customerPhone) {
      return { ok: false, error: "Name and phone number are required" };
    }

    const entry = await addToWaitlist({
      customerName,
      customerPhone,
      partySize,
      specialNotes,
    });

    revalidatePath("/admin/tables");
    return { ok: true, entryId: entry.id };
  } catch (err: unknown) {
    console.error("adminAddToWaitlistAction error:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Failed to add to waitlist" };
  }
}

export async function adminNotifyWaitlistAction(id: string): Promise<ActionState> {
  await requirePermission(permissions.VIEW_MENU);

  try {
    await notifyParty(id);
    revalidatePath("/admin/tables");
    return { ok: true };
  } catch (err: unknown) {
    console.error("adminNotifyWaitlistAction error:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Failed to notify party" };
  }
}

export async function adminSeatWaitlistAction(id: string): Promise<ActionState> {
  await requirePermission(permissions.VIEW_MENU);

  try {
    await seatParty(id);
    revalidatePath("/admin/tables");
    return { ok: true };
  } catch (err: unknown) {
    console.error("adminSeatWaitlistAction error:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Failed to seat party" };
  }
}

export async function adminCancelWaitlistAction(id: string): Promise<ActionState> {
  await requirePermission(permissions.VIEW_MENU);

  try {
    await cancelWaitlistEntry(id);
    revalidatePath("/admin/tables");
    return { ok: true };
  } catch (err: unknown) {
    console.error("adminCancelWaitlistAction error:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Failed to cancel waitlist entry" };
  }
}
