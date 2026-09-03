import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/ui/reveal";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

export function Hero() {
  return (
    <section className="container-site grid items-center gap-12 py-14 md:grid-cols-2 md:gap-16 md:py-24">
      <div className="max-w-xl">
        <Reveal delay={0.05} direction="up">
          <p className="eyebrow mb-4">Hauz Khas Village · New Delhi</p>
        </Reveal>

        <Reveal delay={0.12} direction="up">
          <h1 className="heading-display text-balance text-5xl md:text-6xl lg:text-[4.25rem]">
            Indian food, cooked{" "}
            <span className="text-primary italic">the long way</span>.
          </h1>
        </Reveal>

        <Reveal delay={0.2} direction="up">
          <p className="text-pretty mt-6 max-w-md text-lg leading-relaxed text-muted-foreground">
            Gravies that simmer for six hours, masalas ground fresh every
            morning, breads pulled to order from the tandoor.
          </p>
        </Reveal>

        <Reveal delay={0.28} direction="up">
          <div className="mt-9 flex flex-wrap items-center gap-3.5">
            <Link
              href="/menu"
              className={cn(buttonVariants({ size: "lg" }), "group shadow-md transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]")}
            >
              Explore Menu
              <ArrowRight
                className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                aria-hidden="true"
              />
            </Link>
            <Link
              href="/reservations"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }), "transition-all duration-300 hover:bg-muted hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]")}
            >
              Reserve Table
            </Link>
          </div>
        </Reveal>
      </div>

      <Reveal delay={0.2} direction="up">
        <div className="group relative mx-auto w-full max-w-xl">
          <div
            aria-hidden="true"
            className="absolute -inset-x-3 -top-3 bottom-8 rounded-[1.5rem] border border-border/70 transition-transform duration-500 group-hover:scale-[1.01] sm:-inset-x-5"
          />
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl shadow-card transition-all duration-500 group-hover:shadow-card-hover">
            <Image
              src="/images/hero/hero-dining.jpg"
              alt="Warm, inviting dining room at Spice & Saffron"
              fill
              priority
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
            />
          </div>
          <p className="mt-5 text-right text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Lunch service — Hauz Khas
          </p>
        </div>
      </Reveal>
    </section>
  );
}
