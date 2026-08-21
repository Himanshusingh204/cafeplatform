import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, Flame } from "lucide-react";
import { DishTags } from "@/components/menu/dish-tags";
import { getDishBySlugCached } from "@/lib/services/menu";
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

  return (
    <div className="container-site py-12 md:py-16">
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
        </div>
      </article>
    </div>
  );
}
