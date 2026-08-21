import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/ui/reveal";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

export function Hero() {
  return (
    <section className="container-site grid items-center gap-10 py-14 md:grid-cols-2 md:gap-14 md:py-20">
      <Reveal>
        <div className="max-w-xl">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-primary">
            Indian Café · New Delhi
          </p>
          <h1 className="heading-display text-5xl md:text-6xl lg:text-[4.25rem]">
            Authentic Indian flavours.{" "}
            <span className="text-primary italic">Thoughtfully</span> prepared.
          </h1>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-muted-foreground">
            Slow-cooked gravies, charcoal-grilled tikka and fresh breads from
            the tandoor — served with warmth, every single day.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/menu" className={cn(buttonVariants({ size: "lg" }), "group")}>
              Explore Menu
              <ArrowRight
                className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
            <Link href="/contact" className={buttonVariants({ variant: "outline", size: "lg" })}>
              Plan a Visit
            </Link>
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.15}>
        <div className="relative">
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl shadow-card">
            <Image
              src="/images/placeholders/hero-placeholder.jpg"
              alt="Signature dishes at the café"
              fill
              priority
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
          <div className="absolute -bottom-5 -left-5 hidden rounded-xl border border-border bg-card px-5 py-4 shadow-card sm:block">
            <p className="heading-display text-2xl">Fresh daily</p>
            <p className="text-sm text-muted-foreground">From our tandoor &amp; kitchen</p>
          </div>
        </div>
      </Reveal>
    </section>
  );
}