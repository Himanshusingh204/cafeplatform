import Link from "next/link";
import { Reveal } from "@/components/ui/reveal";
import type { PublicCategory } from "@/lib/services/menu";
import { formatPrice } from "@/lib/utils/format";

export function MenuHighlights({ categories }: { categories: PublicCategory[] }) {
  const highlights = categories.slice(0, 4);

  if (highlights.length === 0) return null;

  return (
    <section className="section-pad">
      <div className="container-site">
        <Reveal>
          <div className="mb-10 text-center">
            <h2 className="heading-display text-3xl md:text-4xl">A menu to explore</h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Starters, curries, breads, biryanis, desserts and beverages — every
              dish built around fresh ingredients and bold, balanced spice.
            </p>
          </div>
        </Reveal>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {highlights.map((category, index) => (
            <Reveal key={category.id} delay={index * 0.08}>
              <Link
                href={`/menu#${category.slug}`}
                className="group flex h-full flex-col rounded-xl border border-border bg-card p-6 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card-hover"
              >
                <h3 className="heading-display text-xl">{category.name}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                  {category.description}
                </p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm font-medium text-primary">
                    {category.dishes.length} {category.dishes.length === 1 ? "dish" : "dishes"}
                  </span>
                  {category.dishes[0] ? (
                    <span className="text-sm text-muted-foreground">
                      from {formatPrice(category.dishes[0].price)}
                    </span>
                  ) : null}
                </div>
              </Link>
            </Reveal>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link href="/menu" className="text-sm font-medium text-primary hover:underline">
            Browse the full menu →
          </Link>
        </div>
      </div>
    </section>
  );
}