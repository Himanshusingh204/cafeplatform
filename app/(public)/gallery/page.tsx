import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { GalleryGrid } from "@/components/gallery/gallery-grid";
import { getPublishedGallery } from "@/lib/services/gallery";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Gallery",
  description:
    "A look inside our café — the space, the food and the people. Photographs from our kitchen and dining room.",
  alternates: { canonical: "/gallery" },
};

export default async function GalleryPage() {
  const images = await getPublishedGallery();

  return (
    <>
      <PageHeader
        title="Inside the café"
        description="The space, the food and the people — a few moments from around Spice & Saffron."
      />

      <div className="container-site py-12 md:py-16">
        <GalleryGrid images={images} />
      </div>
    </>
  );
}
