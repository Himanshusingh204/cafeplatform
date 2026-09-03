"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/guards";
import { permissions } from "@/config/roles";
import { rateLimit } from "@/lib/rate-limit/limiter";
import { limits } from "@/config/limits";
import { messageStatusSchema } from "@/lib/validation/schemas";
import { updateMessageStatus } from "@/lib/services/messages";
import type { ActionState } from "@/app/admin/actions/dishes";

async function guardMutation(adminId: string): Promise<string | null> {
  const limiter = await rateLimit(`admin:${adminId}`, limits.adminMutation.max, limits.adminMutation.windowMs);
  return limiter.success ? null : "Too many changes in a short time. Please wait a moment.";
}

export async function updateMessageStatusAction(id: string, status: string): Promise<ActionState> {
  const admin = await requirePermission(permissions.VIEW_MESSAGES);
  const blocked = await guardMutation(admin.id);
  if (blocked) return { ok: false, error: blocked };

  const parsed = messageStatusSchema.safeParse({ status });
  if (!parsed.success) return { ok: false, error: "Unknown message status." };

  try {
    await updateMessageStatus(id, parsed.data.status, admin.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "NOT_FOUND") return { ok: false, error: "This message no longer exists." };
    return { ok: false, error: "Could not update the message. Please try again." };
  }

  revalidatePath("/admin/messages");
  return { ok: true };
}
