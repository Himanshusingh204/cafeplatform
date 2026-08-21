import type { Metadata } from "next";
import Link from "next/link";
import { Clock, Leaf } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { DishTags } from "@/components/menu/dish-tags";
import { getMenu } from "@/lib/services/menu";
import { formatPrice } from "@/lib/utils/format";

export const metadata: Metadata = {
  title: "Menu",
  description:
    "Explore our full menu — slow-cooked curries, charcoal-grilled tandoori, fresh breads, biryani, desserts and beverages. Prepared fresh every day.",
  alternates: { canonical: "/menu" },
};

export default async function MenuPage() {
  const categories = await getMenu();

  return (
    <>
      <PageHeader
        title="Our menu"
        description="Everything is cooked to order with whole spices and fresh ingredients. Ask us about allergies — we are happy to help."
      />

      <div className="container-site py-12 md:py-16">
        {categories.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
            <p className="heading-display text-2xl">Our menu is being updated</p>
            <p className="mt-2 text-muted-foreground">
              Please check back shortly, or call us for today&apos;s specials.
            </p>
          </div>
        ) : (
          <>
            <nav aria-label="Menu categories" className="mb-12 flex flex-wrap gap-2">
              {categories.map((category) => (
                <a
                  key={category.id}
                  href={`#${category.slug}`}
                  className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:border-primary hover:text-primary"
                >
                  {category.name}
                </a>
              ))}
            </nav>

            <div className="space-y-16 md:space-y-20">
              {categories.map((category) => (
                <section key={category.id} id={category.slug} className="scroll-mt-24">
                  <div className="mb-6 max-w-xl">
                    <h2 className="heading-display text-3xl">{category.name}</h2>
                    {category.description ? (
                      <p className="mt-2 text-muted-foreground">{category.description}</p>
                    ) : null}
                  </div>

                  {category.dishes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Dishes coming soon in this category.
                    </p>
                  ) : (
                    <ul className="grid gap-x-10 gap-y-7 lg:grid-cols-2">
                      {category.dishes.map((dish) => (
                        <li key={dish.id}>
                          <Link
                            href={`/menu/${dish.slug}`}
                            className="group block rounded-lg py-1 transition-colors"
                          >
                            <div className="flex items-baseline gap-3">
                              <h3 className="heading-display text-lg group-hover:text-primary">
                                {dish.name}
                              </h3>
                              <span
                                aria-hidden="true"
                                className="mx-1 flex-1 border-b border-dotted border-border group-hover:border-primary/40"
                              />
                              <span className="whitespace-nowrap font-semibold">
                                {formatPrice(dish.price)}
                              </span>
                            </div>
                            <p className="mt-1 max-w-[60ch] text-sm leading-relaxed text-muted-foreground">
                              {dish.shortDescription}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-3">
                              <DishTags
                                isVegetarian={dish.isVegetarian}
                                isVegan={dish.isVegan}
                                isSpicy={dish.isSpicy}
                                containsNuts={dish.containsNuts}
                              />
                              {dish.preparationTime ? (
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                                  {dish.preparationTime} min
                                </span>
                              ) : null}
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            </div>

            <p className="mt-14 flex items-center gap-2 rounded-lg bg-muted/70 px-4 py-3 text-sm text-muted-foreground">
              <Leaf className="h-4 w-4 text-success" aria-hidden="true" />
              A wide selection of our menu is vegetarian or vegan — look for the green leaf.
            </p>
          </>
        )}
      </div>
    </>
  );
}
