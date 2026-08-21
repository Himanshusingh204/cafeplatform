"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { requirePermission } from "@/lib/auth/guards";
import { permissions } from "@/config/roles";
import { rateLimit } from "@/lib/rate-limit/limiter";
import { limits } from "@/config/limits";
import { categoryInputSchema } from "@/lib/validation/schemas";
import { createCategory, updateCategory, deleteCategory } from "@/lib/services/menu";
import type { ActionState } from "@/app/admin/actions/dishes";

function guardMutation(adminId: string): string | null {
  const limiter = rateLimit(`admin:${adminId}`, limits.adminMutation.max, limits.adminMutation.windowMs);
  return limiter.success ? null : "Too many changes in a short time. Please wait a moment.";
}

function firstIssue(error: unknown): string {
  if (error && typeof error === "object" && "issues" in error) {
    const issues = (error as { issues: { message: string }[] }).issues;
    return issues[0]?.message ?? "Please check the submitted values.";
  }
  return "Please check the submitted values.";
}

export async function saveCategoryAction(input: Record<string, unknown>): Promise<ActionState> {
  const admin = await requirePermission(permissions.EDIT_MENU);
  const blocked = guardMutation(admin.id);
  if (blocked) return { ok: false, error: blocked };

  const parsed = categoryInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const id = typeof input.id === "string" ? input.id : null;

  try {
    if (id) {
      await updateCategory(id, { ...parsed.data, actorId: admin.id });
    } else {
      await createCategory({ ...parsed.data, actorId: admin.id });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "SLUG_TAKEN") return { ok: false, error: "That name is already used by another category." };
    if (message === "NOT_FOUND") return { ok: false, error: "This category no longer exists." };
    return { ok: false, error: "Could not save the category. Please try again." };
  }

  revalidateTag("menu", "max");
  revalidatePath("/admin/categories");
  revalidatePath("/menu");
  return { ok: true };
}

export async function deleteCategoryAction(id: string): Promise<ActionState> {
  const admin = await requirePermission(permissions.DELETE_MENU);
  const blocked = guardMutation(admin.id);
  if (blocked) return { ok: false, error: blocked };

  try {
    await deleteCategory(id, admin.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "CATEGORY_NOT_EMPTY") {
      return { ok: false, error: "Move or delete the dishes in this category first." };
    }
    if (message === "NOT_FOUND") return { ok: false, error: "This category no longer exists." };
    return { ok: false, error: "Could not delete the category. Please try again." };
  }

  revalidateTag("menu", "max");
  revalidatePath("/admin/categories");
  revalidatePath("/menu");
  return { ok: true };
}
