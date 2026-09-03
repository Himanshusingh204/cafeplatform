"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { requirePermission } from "@/lib/auth/guards";
import { permissions } from "@/config/roles";
import { rateLimit } from "@/lib/rate-limit/limiter";
import { limits } from "@/config/limits";
import { dishInputSchema } from "@/lib/validation/schemas";
import {
  createDish,
  updateDish,
  deleteDish,
  toggleDishAvailability,
  toggleDishFeatured,
} from "@/lib/services/menu";

export interface ActionState {
  ok: boolean;
  error?: string;
}

async function guardMutation(adminId: string): Promise<string | null> {
  const limiter = await rateLimit(`admin:${adminId}`, limits.adminMutation.max, limits.adminMutation.windowMs);
  return limiter.success ? null : "Too many changes in a short time. Please wait a moment.";
}

function firstIssue(error: unknown): string {
  if (error && typeof error === "object" && "issues" in error) {
    const issues = (error as { issues: { message: string }[] }).issues;
    return issues[0]?.message ?? "Please check the submitted values.";
  }
  return "Please check the submitted values.";
}

export async function saveDishAction(input: Record<string, unknown>): Promise<ActionState> {
  const admin = await requirePermission(permissions.EDIT_MENU);
  const blocked = await guardMutation(admin.id);
  if (blocked) return { ok: false, error: blocked };

  const parsed = dishInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const id = typeof input.id === "string" ? input.id : null;

  try {
    if (id) {
      await updateDish(id, { ...parsed.data, actorId: admin.id });
    } else {
      await createDish({ ...parsed.data, actorId: admin.id });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "SLUG_TAKEN") return { ok: false, error: "That name is already used by another dish." };
    if (message === "NOT_FOUND") return { ok: false, error: "This dish no longer exists." };
    return { ok: false, error: "Could not save the dish. Please try again." };
  }

  revalidateTag("menu", "max");
  revalidatePath("/admin/dishes");
  revalidatePath("/menu");
  return { ok: true };
}

export async function toggleDishAvailabilityAction(id: string, isAvailable: boolean): Promise<ActionState> {
  const admin = await requirePermission(permissions.EDIT_MENU);
  const blocked = await guardMutation(admin.id);
  if (blocked) return { ok: false, error: blocked };

  try {
    await toggleDishAvailability(id, isAvailable, admin.id);
  } catch {
    return { ok: false, error: "Could not update availability. Please try again." };
  }

  revalidateTag("menu", "max");
  revalidatePath("/admin/dishes");
  revalidatePath("/menu");
  return { ok: true };
}

export async function toggleDishFeaturedAction(id: string, isFeatured: boolean): Promise<ActionState> {
  const admin = await requirePermission(permissions.EDIT_MENU);
  const blocked = await guardMutation(admin.id);
  if (blocked) return { ok: false, error: blocked };

  try {
    await toggleDishFeatured(id, isFeatured, admin.id);
  } catch {
    return { ok: false, error: "Could not update the featured flag. Please try again." };
  }

  revalidateTag("menu", "max");
  revalidatePath("/admin/dishes");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteDishAction(id: string): Promise<ActionState> {
  const admin = await requirePermission(permissions.DELETE_MENU);
  const blocked = await guardMutation(admin.id);
  if (blocked) return { ok: false, error: blocked };

  try {
    await deleteDish(id, admin.id);
  } catch {
    return { ok: false, error: "Could not delete the dish. Please try again." };
  }

  revalidateTag("menu", "max");
  revalidatePath("/admin/dishes");
  revalidatePath("/menu");
  return { ok: true };
}
