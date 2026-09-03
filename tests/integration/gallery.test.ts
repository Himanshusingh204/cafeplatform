import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@/lib/db/prisma";
import {
  createGalleryImage,
  deleteGalleryImage,
  listGalleryAdmin,
  updateGalleryImage,
} from "@/lib/services/gallery";
import { makeAdmin, truncateTables, uniqueSuffix } from "../helpers/db";

let testAdminId: string;

beforeAll(async () => {
  await truncateTables("ActivityLog", "GalleryImage", "Admin");
  const admin = await makeAdmin();
  testAdminId = admin.id;
});

afterAll(async () => {
  await truncateTables("ActivityLog", "GalleryImage", "Admin");
});

function galleryInput(overrides: Partial<{ title: string; category: "FOOD" | "INTERIOR" | "CHEF" | "EVENTS" | "ATMOSPHERE" }> = {}) {
  const suffix = uniqueSuffix();
  return {
    title: overrides.title ?? `Gallery Image ${suffix}`,
    altText: `Alt text for image ${suffix}`,
    imageUrl: `/images/placeholders/gallery-${suffix}.jpg`,
    category: overrides.category ?? "FOOD" as const,
    sortOrder: 10,
    isPublished: true,
    actorId: testAdminId,
  };
}

describe("gallery CRUD", () => {
  it("creates a gallery image with audit log", async () => {
    const input = galleryInput();
    const image = await createGalleryImage(input);

    expect(image.title).toBe(input.title);
    expect(image.altText).toBe(input.altText);
    expect(image.imageUrl).toBe(input.imageUrl);
    expect(image.category).toBe("FOOD");
    expect(image.isPublished).toBe(true);

    const log = await db.activityLog.findFirst({
      where: { entityType: "GALLERY", entityId: image.id },
    });
    expect(log?.action).toBe("CREATE");
  });

  it("lists all gallery images for admin", async () => {
    const input = galleryInput({ title: `Admin List ${uniqueSuffix()}` });
    await createGalleryImage(input);

    const images = await listGalleryAdmin();
    expect(images.length).toBeGreaterThan(0);
    expect(images.some((img) => img.title === input.title)).toBe(true);
  });

  it("updates a gallery image", async () => {
    const created = await createGalleryImage(galleryInput());
    const updated = await updateGalleryImage(created.id, {
      title: `Updated Title ${uniqueSuffix()}`,
      altText: "Updated alt text",
      category: "INTERIOR",
      sortOrder: 20,
      isPublished: false,
      actorId: testAdminId,
    });

    expect(updated.title).not.toBe(created.title);
    expect(updated.category).toBe("INTERIOR");
    expect(updated.isPublished).toBe(false);

    const log = await db.activityLog.findFirst({
      where: { entityType: "GALLERY", entityId: created.id, action: "UPDATE" },
    });
    expect(log).toBeTruthy();
  });

  it("throws NOT_FOUND when updating non-existent image", async () => {
    await expect(
      updateGalleryImage("00000000-0000-0000-0000-000000000000", {
        title: "Test",
        altText: "Test",
        category: "FOOD",
        sortOrder: 0,
        isPublished: true,
      })
    ).rejects.toThrow("NOT_FOUND");
  });

  it("deletes a gallery image", async () => {
    const created = await createGalleryImage(galleryInput());
    await deleteGalleryImage(created.id, testAdminId);

    const images = await listGalleryAdmin();
    expect(images.some((img) => img.id === created.id)).toBe(false);

    const log = await db.activityLog.findFirst({
      where: { entityType: "GALLERY", entityId: created.id, action: "DELETE" },
    });
    expect(log).toBeTruthy();
  });

  it("throws NOT_FOUND when deleting non-existent image", async () => {
    await expect(
      deleteGalleryImage("00000000-0000-0000-0000-000000000000")
    ).rejects.toThrow("NOT_FOUND");
  });

  it("preserves existing imageUrl when not provided in update", async () => {
    const created = await createGalleryImage(galleryInput());
    const originalUrl = created.imageUrl;

    const updated = await updateGalleryImage(created.id, {
      title: "New Title",
      altText: "New Alt",
      category: "CHEF",
      sortOrder: 0,
      isPublished: true,
    });

    expect(updated.imageUrl).toBe(originalUrl);
  });
});
