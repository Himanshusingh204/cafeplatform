import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getPublishedGallery } from "@/lib/services/gallery";
import { Reveal } from "@/components/ui/reveal";
import { cn } from "@/lib/utils/cn";

const ASPECT_CLASSES = ["aspect-[4/3]", "aspect-[4/5]", "aspect-square", "aspect-[3/4]", "aspect-[5/4]"];
const SPAN_CLASSES = [
  "md:col-span-7",
  "md:col-span-5 md:pt-16",
  "md:col-span-5 md:col-start-8 md:-mt-10",
  "md:col-span-6",
  "md:col-span-6 md:pt-8",
];

export async function GalleryPreview() {
  let images: { id: string; imageUrl: string; altText: string; title: string }[] = [];
  try {
    const all = await getPublishedGallery();
    images = all.slice(0, 3);
  } catch {
    return null;
  }

  if (images.length === 0) {
    return null;
  }

  return (
    <section className="section-pad bg-muted/60">
      <div className="container-site">
        <Reveal>
          <div className="mb-12 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow mb-2">Around here</p>
              <h2 className="heading-display text-3xl md:text-4xl">
                Slow afternoons, full tables
              </h2>
            </div>
          </div>
        </Reveal>

        <div className="grid gap-x-5 gap-y-10 md:grid-cols-12">
          {images.map((image, index) => (
            <Reveal
              key={image.id}
              delay={index * 0.08}
              className={cn("group", SPAN_CLASSES[index % SPAN_CLASSES.length])}
            >
              <Link href="/gallery" className="block">
                <div className={cn("relative overflow-hidden rounded-xl", ASPECT_CLASSES[index % ASPECT_CLASSES.length])}>
                  <Image
                    src={image.imageUrl}
                    alt={image.altText}
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                </div>
                <span className="mt-3 flex items-center gap-2 text-sm font-medium text-foreground">
                  <span className="tabular text-xs text-muted-foreground">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {image.title}
                  <ArrowUpRight
                    className="h-3.5 w-3.5 text-muted-foreground transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </span>
              </Link>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.15}>
          <div className="mt-14">
            <Link
              href="/gallery"
              className="inline-flex items-center gap-2 border-b border-primary/40 pb-1 text-sm font-medium text-primary transition-colors hover:border-primary"
            >
              See the full gallery
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
