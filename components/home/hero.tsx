import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Star, Flame, Sparkles, Utensils, Heart } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-8 pb-16 md:pt-16 md:pb-24">
      {/* Subtle Warm Amber Glow Background */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-96 w-[48rem] -translate-x-1/2 bg-linear-to-b from-primary/15 via-primary/5 to-transparent blur-3xl opacity-70"
      />

      <div className="container-site grid items-center gap-12 lg:grid-cols-12 lg:gap-16">
        {/* Left Column: Instant Paint Hero Content */}
        <div className="max-w-2xl lg:col-span-7 space-y-6">
          {/* Eyebrow & Live Status Pill */}
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3.5 py-1 text-xs font-semibold text-primary shadow-xs">
            <Sparkles className="h-3.5 w-3.5 text-primary animate-pulse" />
            <span>Hauz Khas Village · New Delhi</span>
            <span className="text-primary/40">|</span>
            <span className="flex items-center gap-1 text-[11px] text-foreground font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-success inline-block" />
              Kitchen Open Now
            </span>
          </div>

          {/* Heading - Renders immediately without JS opacity delay for 100/100 Lighthouse LCP */}
          <h1 className="heading-display text-balance text-4xl sm:text-5xl md:text-6xl lg:text-[4rem] font-extrabold tracking-tight text-foreground leading-[1.08]">
            Royal Indian Flavours, Crafted{" "}
            <span className="text-primary italic font-serif relative">
              The Heritage Way
              <svg
                aria-hidden="true"
                viewBox="0 0 250 12"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="absolute -bottom-1 left-0 w-full text-primary/30"
              >
                <path
                  d="M2 9.5C65 2.5 185 2 248 9.5"
                  stroke="currentColor"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            .
          </h1>

          <p className="text-pretty text-base sm:text-lg leading-relaxed text-muted-foreground max-w-xl">
            Dal Makhani slow-simmered for 16 hours over charcoal embers. Hand-pounded aromatic masalas, and crispy tandoori breads pulled to order.
          </p>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center gap-3.5 pt-2">
            <Link
              href="/menu"
              className={cn(
                buttonVariants({ size: "lg" }),
                "group shadow-md shadow-primary/20 bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
              )}
            >
              <span>Explore Full Menu</span>
              <ArrowRight
                className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                aria-hidden="true"
              />
            </Link>
            <Link
              href="/reservations"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "border-border bg-card/80 hover:bg-card hover:border-primary/40 text-foreground transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0"
              )}
            >
              <span>Book a Table</span>
            </Link>
          </div>

          {/* Highlights & Culinary Badges */}
          <div className="grid grid-cols-3 gap-3 border-t border-border/70 pt-6 max-w-lg">
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-foreground flex items-center gap-1">
                <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                4.9 / 5.0
              </p>
              <p className="text-[11px] text-muted-foreground">850+ Verified Reviews</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-foreground flex items-center gap-1">
                <Flame className="h-3.5 w-3.5 text-primary" />
                Live Tandoor
              </p>
              <p className="text-[11px] text-muted-foreground">Charcoal-Smoked</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-foreground flex items-center gap-1">
                <Heart className="h-3.5 w-3.5 text-emerald-500" />
                100% Desi Ghee
              </p>
              <p className="text-[11px] text-muted-foreground">Fresh Daily Prep</p>
            </div>
          </div>
        </div>

        {/* Right Column: Hero Visual with Overlaid Floating Badges */}
        <div className="relative mx-auto w-full max-w-lg lg:col-span-5">
          {/* Subtle Outer Frame */}
          <div
            aria-hidden="true"
            className="absolute -inset-3 rounded-3xl border border-primary/20 bg-linear-to-br from-primary/10 via-transparent to-card/50 blur-xs -z-10"
          />

          <div className="relative aspect-4/3 overflow-hidden rounded-2xl border border-border shadow-card group">
            <Image
              src="/images/hero/hero-dining.jpg"
              alt="Warm, inviting fine dining room at Spice & Saffron New Delhi"
              fill
              priority
              fetchPriority="high"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 40vw"
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
            />
            {/* Soft dark gradient vignette */}
            <div className="absolute inset-0 bg-linear-to-t from-black/60 via-black/10 to-transparent" />

            {/* Bottom Caption */}
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-white">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">Dining Experience</p>
                <p className="text-sm font-medium">Hauz Khas Heritage Room</p>
              </div>
              <span className="rounded-full bg-black/50 backdrop-blur-md px-3 py-1 text-[11px] font-semibold border border-white/20">
                ⭐ Michelin Recommended
              </span>
            </div>
          </div>

          {/* Floating Live Badge */}
          <div className="absolute -bottom-4 -left-4 hidden sm:flex items-center gap-2.5 rounded-xl border border-border bg-card/95 backdrop-blur-md px-4 py-2.5 shadow-lg">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <Utensils className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">Artisanal Dining</p>
              <p className="text-[10px] text-muted-foreground">Lunch & Dinner Service</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
