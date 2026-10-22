import "server-only";

import { unstable_cache } from "next/cache";
import { db } from "@/lib/db/prisma";
import { logAction } from "@/lib/services/audit";
import { resolveTenant } from "@/lib/db/tenant";
import { assertWithinPlan } from "@/lib/plans";
import type { GalleryCategory } from "@/lib/generated/prisma/enums";

async function fetchPublishedGallery(tenantId: string) {
  try {
    const images = await db.galleryImage.findMany({
      where: { tenantId, isPublished: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        title: true,
        altText: true,
        imageUrl: true,
        category: true,
      },
    });
    return images;
  } catch (error) {
    console.error("fetchPublishedGallery: database query failed", error);
    return [];
  }
}

export const getGalleryCached = unstable_cache(fetchPublishedGallery, ["gallery"], {
  tags: ["gallery"],
  revalidate: 300,
});

export async function getPublishedGallery(tenantId?: string) {
  return getGalleryCached(tenantId ?? (await resolveTenant()).id);
}

export async function listGalleryAdmin(tenantId: string) {
  try {
    return await db.galleryImage.findMany({ where: { tenantId }, orderBy: { sortOrder: "asc" } });
  } catch {
    return [];
  }
}

export async function createGalleryImage(
  input: {
    tenantId: string;
    title: string;
    altText: string;
    imageUrl: string;
    category: GalleryCategory;
    sortOrder: number;
    isPublished: boolean;
    actorId?: string | null;
  }
) {
  await assertWithinPlan(input.tenantId, "galleryImages");

  const image = await db.galleryImage.create({
    data: {
      tenantId: input.tenantId,
      title: input.title,
      altText: input.altText,
      imageUrl: input.imageUrl,
      category: input.category,
      sortOrder: input.sortOrder,
      isPublished: input.isPublished,
    },
  });

  await logAction({
    actorId: input.actorId,
    action: "CREATE",
    entityType: "GALLERY",
    entityId: image.id,
    metadata: { title: image.title },
  });

  return image;
}

export async function updateGalleryImage(
  id: string,
  input: {
    tenantId: string;
    title: string;
    altText: string;
    imageUrl?: string;
    category: GalleryCategory;
    sortOrder: number;
    isPublished: boolean;
    actorId?: string | null;
  }
) {
  const existing = await db.galleryImage.findFirst({ where: { id, tenantId: input.tenantId } });
  if (!existing) throw new Error("NOT_FOUND");

  const image = await db.galleryImage.update({
    where: { id },
    data: {
      title: input.title,
      altText: input.altText,
      imageUrl: input.imageUrl ?? existing.imageUrl,
      category: input.category,
      sortOrder: input.sortOrder,
      isPublished: input.isPublished,
    },
  });

  await logAction({
    actorId: input.actorId,
    action: "UPDATE",
    entityType: "GALLERY",
    entityId: image.id,
    metadata: { title: image.title },
  });

  return image;
}

export async function deleteGalleryImage(id: string, tenantId: string, actorId?: string | null) {
  const existing = await db.galleryImage.findFirst({ where: { id, tenantId } });
  if (!existing) throw new Error("NOT_FOUND");

  await db.galleryImage.delete({ where: { id } });

  await logAction({
    actorId,
    action: "DELETE",
    entityType: "GALLERY",
    entityId: id,
    metadata: { title: existing.title },
  });
}