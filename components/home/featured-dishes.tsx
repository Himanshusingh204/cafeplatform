import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/ui/reveal";
import { DishCard } from "@/components/menu/dish-card";
import type { PublicDish } from "@/lib/services/menu";

export function FeaturedDishes({ featured }: { featured: PublicDish[] }) {
  if (featured.length === 0) return null;

  return (
    <section className="section-pad">
      <div className="container-site">
        <Reveal>
          <div className="mb-10 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
            <div>
              <p className="eyebrow mb-2">House favourites</p>
              <h2 className="heading-display text-3xl md:text-4xl">
                What the regulars order
              </h2>
            </div>
            <Link
              href="/menu"
              className="flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-primary"
            >
              Full menu <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </Reveal>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {featured.slice(0, 4).map((dish, index) => (
            <Reveal
              key={dish.id}
              delay={(index % 4) * 0.08}
            >
              <DishCard dish={dish} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
