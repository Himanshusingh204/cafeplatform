import Image from "next/image";
import { Reveal } from "@/components/ui/reveal";

export interface GalleryItem {
  id: string;
  title: string;
  altText: string;
  imageUrl: string;
  category: string;
}

interface GalleryGridProps {
  images: GalleryItem[];
}

export function GalleryGrid({ images }: GalleryGridProps) {
  if (images.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
        <p className="heading-display text-2xl">Photographs coming soon</p>
        <p className="mt-2 text-muted-foreground">
          We are busy cooking — new photos are on their way.
        </p>
      </div>
    );
  }

  return (
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
  );
}
