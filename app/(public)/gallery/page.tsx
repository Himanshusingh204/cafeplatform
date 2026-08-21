import type { Metadata } from "next";
import Image from "next/image";
import { PageHeader } from "@/components/layout/page-header";
import { Reveal } from "@/components/ui/reveal";
import { getPublishedGallery } from "@/lib/services/gallery";

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
        {images.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
            <p className="heading-display text-2xl">Photographs coming soon</p>
            <p className="mt-2 text-muted-foreground">
              We are busy cooking — new photos are on their way.
            </p>
          </div>
        ) : (
          <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 [&>*]:mb-4">
            {images.map((image, index) => (
              <Reveal key={image.id} delay={(index % 3) * 0.06}>
                <figure className="group break-inside-avoid overflow-hidden rounded-xl shadow-card">
                  <Image
                    src={image.imageUrl}
                    alt={image.altText}
                    width={800}
                    height={600}
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                  <figcaption className="flex items-center justify-between gap-3 bg-card px-4 py-3">
                    <span className="text-sm font-medium">{image.title}</span>
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">
                      {image.category.toLowerCase()}
                    </span>
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
