import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Reveal } from "@/components/ui/reveal";

const highlights = [
  {
    href: "/gallery",
    image: "/images/placeholders/gallery-placeholder.jpg",
    alt: "Warm café interior with wooden tables and soft lighting",
    label: "The space",
  },
  {
    href: "/menu",
    image: "/images/placeholders/dish-placeholder.jpg",
    alt: "Signature dishes plated and ready to serve",
    label: "The food",
  },
  {
    href: "/about",
    image: "/images/placeholders/about-placeholder.jpg",
    alt: "Our team preparing food in the open kitchen",
    label: "The people",
  },
];

export function GalleryPreview() {
  return (
    <section className="section-pad bg-muted/60">
      <div className="container-site">
        <Reveal>
          <div className="mb-10 text-center">
            <h2 className="heading-display text-3xl md:text-4xl">Café moments</h2>
          </div>
        </Reveal>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {highlights.map((item, index) => (
            <Reveal key={item.label} delay={index * 0.08}>
              <Link
                href={item.href}
                className="group relative block overflow-hidden rounded-xl shadow-card transition-shadow duration-300 hover:shadow-card-hover"
              >
                <Image
                  src={item.image}
                  alt={item.alt}
                  width={600}
                  height={450}
                  className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" aria-hidden="true" />
                <div className="absolute bottom-4 left-4 flex items-center gap-1.5 text-sm font-medium text-white">
                  {item.label}
                  <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
                </div>
              </Link>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.2}>
          <div className="mt-8 text-center">
            <Link
              href="/gallery"
              className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline underline-offset-4"
            >
              View the full gallery
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
