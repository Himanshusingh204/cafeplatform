"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/guards";
import { permissions } from "@/config/roles";
import { rateLimit } from "@/lib/rate-limit/limiter";
import { limits } from "@/config/limits";
import { settingsInputSchema } from "@/lib/validation/schemas";
import { updateSettings } from "@/lib/services/settings";
import type { ActionState } from "@/app/admin/actions/dishes";

export async function updateSettingsAction(input: Record<string, unknown>): Promise<ActionState> {
  const admin = await requirePermission(permissions.MANAGE_SETTINGS);
  const limiter = await rateLimit(`admin:${admin.id}`, limits.adminMutation.max, limits.adminMutation.windowMs);
  if (!limiter.success) return { ok: false, error: "Too many changes in a short time. Please wait a moment." };

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
