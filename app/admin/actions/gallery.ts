"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { requirePermission } from "@/lib/auth/guards";
import { permissions } from "@/config/roles";
import { rateLimit } from "@/lib/rate-limit/limiter";
import { limits } from "@/config/limits";
import { galleryInputSchema } from "@/lib/validation/schemas";
import {
  createGalleryImage,
  updateGalleryImage,
  deleteGalleryImage,
} from "@/lib/services/gallery";
import type { ActionState } from "@/app/admin/actions/dishes";

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

export async function saveGalleryImageAction(input: Record<string, unknown>): Promise<ActionState> {
  const admin = await requirePermission(permissions.MANAGE_GALLERY);
  const blocked = await guardMutation(admin.id);
  if (blocked) return { ok: false, error: blocked };

  const id = typeof input.id === "string" ? input.id : null;
  const parsed = galleryInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const imageUrl = typeof input.imageUrl === "string" ? input.imageUrl.trim() : "";
  if (!imageUrl) return { ok: false, error: "Please provide an image path or URL." };
  if (imageUrl.length > 500) return { ok: false, error: "The image path is too long." };

  try {
    if (id) {
      await updateGalleryImage(id, { ...parsed.data, imageUrl, actorId: admin.id });
    } else {
      await createGalleryImage({ ...parsed.data, imageUrl, actorId: admin.id });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "NOT_FOUND") return { ok: false, error: "This image no longer exists." };
    return { ok: false, error: "Could not save the image. Please try again." };
  }

  revalidateTag("gallery", "max");
  revalidatePath("/admin/gallery");
  revalidatePath("/gallery");
  return { ok: true };
}

export async function deleteGalleryImageAction(id: string): Promise<ActionState> {
  const admin = await requirePermission(permissions.MANAGE_GALLERY);
  const blocked = await guardMutation(admin.id);
  if (blocked) return { ok: false, error: blocked };

  try {
    await deleteGalleryImage(id, admin.id);
  } catch {
    return { ok: false, error: "Could not delete the image. Please try again." };
  }

  revalidateTag("gallery", "max");
  revalidatePath("/admin/gallery");
  revalidatePath("/gallery");
  return { ok: true };
}
