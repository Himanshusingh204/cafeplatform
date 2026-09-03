"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { requirePermission } from "@/lib/auth/guards";
import { permissions } from "@/config/roles";
import { moderateReview, deleteReview } from "@/lib/services/reviews";

export interface ActionState {
  ok: boolean;
  error?: string;
}

export async function moderateReviewAction(
  id: string,
  data: { isApproved?: boolean; isFeatured?: boolean }
): Promise<ActionState> {
  const admin = await requirePermission(permissions.VIEW_MESSAGES);

  try {
    await moderateReview(id, data, admin.id);
    revalidatePath("/admin/reviews");
    revalidatePath("/");
    revalidateTag("reviews", "max");
    return { ok: true };
  } catch (error) {
    console.error("moderateReviewAction error:", error);
    return { ok: false, error: "Failed to update review." };
  }
}

export async function deleteReviewAction(id: string): Promise<ActionState> {
  const admin = await requirePermission(permissions.DELETE_MENU);

  try {
    await deleteReview(id, admin.id);
    revalidatePath("/admin/reviews");
    revalidatePath("/");
    revalidateTag("reviews", "max");
    return { ok: true };
  } catch (error) {
    console.error("deleteReviewAction error:", error);
    return { ok: false, error: "Failed to delete review." };
  }
}
