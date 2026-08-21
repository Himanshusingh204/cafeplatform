import "server-only";

import { unstable_cache } from "next/cache";
import { db } from "@/lib/db/prisma";
import { logAction } from "@/lib/services/audit";
import type { GalleryCategory } from "@/lib/generated/prisma/enums";

async function fetchPublishedGallery() {
  const images = await db.galleryImage.findMany({
    where: { isPublished: true },
    orderBy: { sortOrder: "asc" },
  });
  return images.map((img) => ({
    id: img.id,
    title: img.title,
    altText: img.altText,
    imageUrl: img.imageUrl,
    category: img.category,
  }));
}

export const getGalleryCached = unstable_cache(fetchPublishedGallery, ["gallery"], {
  tags: ["gallery"],
  revalidate: 300,
});

export async function getPublishedGallery() {
  return getGalleryCached();
}

export async function listGalleryAdmin() {
  return db.galleryImage.findMany({ orderBy: { sortOrder: "asc" } });
}

export async function createGalleryImage(
  input: {
    title: string;
    altText: string;
    imageUrl: string;
    category: GalleryCategory;
    sortOrder: number;
    isPublished: boolean;
    actorId?: string | null;
  }
) {
  const image = await db.galleryImage.create({
    data: {
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
    title: string;
    altText: string;
    imageUrl?: string;
    category: GalleryCategory;
    sortOrder: number;
    isPublished: boolean;
    actorId?: string | null;
  }
) {
  const existing = await db.galleryImage.findUnique({ where: { id } });
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

export async function deleteGalleryImage(id: string, actorId?: string | null) {
  const existing = await db.galleryImage.findUnique({ where: { id } });
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