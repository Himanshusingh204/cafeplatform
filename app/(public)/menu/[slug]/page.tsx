import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, Flame } from "lucide-react";
import { DishCard } from "@/components/menu/dish-card";
import { DishTags } from "@/components/menu/dish-tags";
import { DishAddButton } from "@/components/menu/dish-add-button";
import { getDishBySlugCached, getRelatedDishes } from "@/lib/services/menu";
import { formatPrice } from "@/lib/utils/format";

interface DishPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: DishPageProps): Promise<Metadata> {
  const { slug } = await params;
  const dish = await getDishBySlugCached(slug);
  if (!dish) return { title: "Dish not found" };

  return {
    title: dish.name,
    description: dish.shortDescription,
    alternates: { canonical: `/menu/${dish.slug}` },
    openGraph: {
      title: dish.name,
      description: dish.shortDescription,
      images: dish.image ? [{ url: dish.image }] : undefined,
    },
  };
}

export default async function DishPage({ params }: DishPageProps) {
  const { slug } = await params;
  const dish = await getDishBySlugCached(slug);
  if (!dish) notFound();

  const relatedDishes = await getRelatedDishes(dish.categorySlug, dish.slug, 3);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "MenuItem",
    name: dish.name,
    description: dish.description,
    image: dish.image,
    offers: {
      "@type": "Offer",
      price: dish.price,
      priceCurrency: "INR",
      availability: "https://schema.org/InStock",
    },
    suitableForDiet: [
      dish.isVegetarian ? "https://schema.org/VegetarianDiet" : null,
      dish.isVegan ? "https://schema.org/VeganDiet" : null,
    ].filter(Boolean),
  };

  return (
    <div className="container-site py-12 md:py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Link
        href="/menu"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to menu
      </Link>

      <article className="mt-8 grid items-start gap-10 md:grid-cols-2 md:gap-14">
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl shadow-card">
          <Image
            src={dish.image ?? "/images/placeholders/dish-placeholder.jpg"}
            alt={dish.name}
            fill
            priority
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover"
          />
        </div>

        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            {dish.categoryName}
          </p>
          <h1 className="heading-display mt-2 text-4xl md:text-5xl">{dish.name}</h1>

          <div className="mt-5 flex items-baseline gap-3">
            <span className="heading-display text-3xl text-primary">
              {formatPrice(dish.price)}
            </span>
            {dish.compareAtPrice ? (
              <span className="text-lg text-muted-foreground line-through">
                {formatPrice(dish.compareAtPrice)}
              </span>
            ) : null}
          </div>

          <p className="mt-6 max-w-[60ch] leading-relaxed text-muted-foreground">
            {dish.description}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <DishTags
              isVegetarian={dish.isVegetarian}
              isVegan={dish.isVegan}
              isSpicy={dish.isSpicy}
              containsNuts={dish.containsNuts}
            />
          </div>

          <dl className="mt-8 grid grid-cols-2 gap-4 border-t border-border pt-6 sm:max-w-sm">
            {dish.preparationTime ? (
              <div className="flex items-center gap-2.5">
                <Clock className="h-4 w-4 text-primary" aria-hidden="true" />
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Preparation
                  </dt>
                  <dd className="text-sm font-medium">{dish.preparationTime} minutes</dd>
                </div>
              </div>
            ) : null}
            {dish.calories ? (
              <div className="flex items-center gap-2.5">
                <Flame className="h-4 w-4 text-primary" aria-hidden="true" />
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Energy
                  </dt>
                  <dd className="text-sm font-medium">{dish.calories} kcal</dd>
                </div>
              </div>
            ) : null}
          </dl>

          <DishAddButton
            dish={{
              id: dish.id,
              name: dish.name,
              slug: dish.slug,
              price: dish.price,
              image: dish.image,
            }}
          />
        </div>
      </article>

      {/* Recommended Dishes from the same category */}
      {relatedDishes.length > 0 && (
        <section className="mt-20 border-t border-border pt-12">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow mb-1">More from our kitchen</p>
              <h2 className="heading-display text-2xl md:text-3xl">
                More in {dish.categoryName}
              </h2>
            </div>
            <Link
              href={`/menu#${dish.categorySlug}`}
              className="text-sm font-medium text-primary hover:underline"
            >
              See all {dish.categoryName} &rarr;
            </Link>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {relatedDishes.map((item) => (
              <DishCard key={item.id} dish={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
