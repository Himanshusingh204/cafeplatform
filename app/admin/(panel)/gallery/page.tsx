import type { Metadata } from "next";
import { GalleryManager } from "@/components/admin/gallery-manager";
import { listGalleryAdmin } from "@/lib/services/gallery";
import { requirePermission } from "@/lib/auth/guards";
import { permissions } from "@/config/roles";

export const metadata: Metadata = { title: "Gallery" };

export const dynamic = "force-dynamic";

export default async function AdminGalleryPage() {
  await requirePermission(permissions.MANAGE_GALLERY);
  const images = await listGalleryAdmin();

  return (
    <GalleryManager
      images={images.map((image) => ({
        id: image.id,
        title: image.title,
        altText: image.altText,
        imageUrl: image.imageUrl,
        category: image.category,
        sortOrder: image.sortOrder,
        isPublished: image.isPublished,
      }))}
    />
  );
}
