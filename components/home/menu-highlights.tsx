import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Reveal } from "@/components/ui/reveal";
import type { PublicCategory } from "@/lib/services/menu";
import { formatPrice } from "@/lib/utils/format";

export function MenuHighlights({ categories }: { categories: PublicCategory[] }) {
  const highlights = categories.slice(0, 5);

  if (highlights.length === 0) return null;

  return (
    <section className="section-pad">
      <div className="container-site max-w-4xl">
        <Reveal>
          <div className="mb-2 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow mb-2">The kitchen</p>
              <h2 className="heading-display text-3xl md:text-4xl">
                Work your way through
              </h2>
            </div>
          </div>
        </Reveal>

        <ol>
          {highlights.map((category, index) => (
            <Reveal key={category.id} delay={Math.min(index * 0.05, 0.15)}>
              <li className="border-b border-border">
                <Link
                  href={`/menu#${category.slug}`}
                  className="group grid grid-cols-[2.5rem_1fr_auto] items-baseline gap-x-4 py-6 transition-colors md:grid-cols-[3.5rem_1fr_auto] md:py-7"
                >
                  <span className="tabular text-sm text-muted-foreground">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span>
                    <h3 className="heading-display text-2xl transition-colors duration-300 group-hover:text-primary md:text-[1.75rem]">
                      {category.name}
                    </h3>
                    <p className="text-pretty mt-1.5 max-w-lg text-sm leading-relaxed text-muted-foreground">
                      {category.description}
                    </p>
                  </span>
                  <span className="flex items-baseline gap-4 text-sm">
                    <span className="hidden text-muted-foreground sm:inline">
                      from {formatPrice(category.dishes[0]?.price ?? 0)}
                    </span>
                    <ArrowUpRight
                      className="h-4 w-4 self-center text-muted-foreground transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary"
                      aria-hidden="true"
                    />
                  </span>
                </Link>
              </li>
            </Reveal>
          ))}
        </ol>

        <div className="mt-8 flex items-center justify-between">
          <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            {categories.length} categories · updated weekly
          </span>
          <Link
            href="/menu"
            className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline underline-offset-4"
          >
            Browse the full menu
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
