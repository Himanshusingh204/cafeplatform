"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/guards";
import { permissions } from "@/config/roles";
import {
  createTable,
  updateTable,
  updateTableStatus,
  deleteTable,
} from "@/lib/services/tables";
import type { TableStatus, TableShape } from "@/lib/generated/prisma/enums";

export interface ActionState {
  ok: boolean;
  error?: string;
}

export async function adminCreateTableAction(formData: FormData): Promise<ActionState> {
  await requirePermission(permissions.MANAGE_SETTINGS);

  try {
    const tableNumber = String(formData.get("tableNumber") || "").trim();
    const capacity = Number(formData.get("capacity") || 4);
    const shape = (String(formData.get("shape") || "RECTANGLE") as TableShape);
    const section = String(formData.get("section") || "Main Dining").trim();
    const posX = Number(formData.get("posX") || 100);
    const posY = Number(formData.get("posY") || 100);

    if (!tableNumber) {
      return { ok: false, error: "Table number is required" };
    }

    await createTable({
      tableNumber,
      capacity,
      shape,
      section,
      posX,
      posY,
    });

    revalidatePath("/admin/tables");
    return { ok: true };
  } catch (err: unknown) {
    console.error("adminCreateTableAction error:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Failed to create table" };
  }
}

export async function adminUpdateTableStatusAction(
  id: string,
  status: TableStatus
): Promise<ActionState> {
  await requirePermission(permissions.VIEW_MENU);

  try {
    await updateTableStatus(id, status);
    revalidatePath("/admin/tables");
    return { ok: true };
  } catch (err: unknown) {
    console.error("adminUpdateTableStatusAction error:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Failed to update table status" };
  }
}

export async function adminUpdateTablePositionAction(
  id: string,
  posX: number,
  posY: number
): Promise<ActionState> {
  await requirePermission(permissions.MANAGE_SETTINGS);

  try {
    await updateTable(id, { posX, posY });
    revalidatePath("/admin/tables");
    return { ok: true };
  } catch (err: unknown) {
    console.error("adminUpdateTablePositionAction error:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Failed to update position" };
  }
}

export async function adminDeleteTableAction(id: string): Promise<ActionState> {
  await requirePermission(permissions.MANAGE_SETTINGS);

  try {
    await deleteTable(id);
    revalidatePath("/admin/tables");
    return { ok: true };
  } catch (err: unknown) {
    console.error("adminDeleteTableAction error:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Failed to delete table" };
  }
}
