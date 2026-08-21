"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/guards";
import { permissions } from "@/config/roles";
import { rateLimit } from "@/lib/rate-limit/limiter";
import { limits } from "@/config/limits";
import { messageStatusSchema, settingsInputSchema } from "@/lib/validation/schemas";
import { updateMessageStatus } from "@/lib/services/messages";
import { updateSettings } from "@/lib/services/settings";
import type { ActionState } from "@/app/admin/actions/dishes";

function guardMutation(adminId: string): string | null {
  const limiter = rateLimit(`admin:${adminId}`, limits.adminMutation.max, limits.adminMutation.windowMs);
  return limiter.success ? null : "Too many changes in a short time. Please wait a moment.";
}

export async function updateMessageStatusAction(id: string, status: string): Promise<ActionState> {
  const admin = await requirePermission(permissions.VIEW_MESSAGES);
  const blocked = guardMutation(admin.id);
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

export async function updateSettingsAction(input: Record<string, unknown>): Promise<ActionState> {
  const admin = await requirePermission(permissions.MANAGE_SETTINGS);
  const blocked = guardMutation(admin.id);
  if (blocked) return { ok: false, error: blocked };

  const parsed = settingsInputSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue ? `${issue.path.join(".")}: ${issue.message}` : "Please check the values." };
  }

  try {
    await updateSettings(parsed.data, admin.id);
  } catch {
    return { ok: false, error: "Could not save settings. Please try again." };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}
