import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/ui/reveal";
import { Hero } from "@/components/home/hero";
import { FeaturedDishes } from "@/components/home/featured-dishes";
import { AboutPreview } from "@/components/home/about-preview";
import { MenuHighlights } from "@/components/home/menu-highlights";
import { GalleryPreview } from "@/components/home/gallery-preview";
import { WhyVisit } from "@/components/home/why-visit";
import { ReviewsSection } from "@/components/reviews/reviews-section";
import { buttonVariants } from "@/components/ui/button";
import { getMenu } from "@/lib/services/menu";
import { getApprovedReviews } from "@/lib/services/reviews";
import { cn } from "@/lib/utils/cn";

export default async function HomePage() {
  const [categories, reviews] = await Promise.all([
    getMenu(),
    getApprovedReviews(),
  ]);

  const featured = categories
    .flatMap((category) => category.dishes)
    .filter((dish) => dish.isFeatured)
    .slice(0, 4);

  return (
    <main className="flex-1">
      <Hero />
      <FeaturedDishes featured={featured} />
      <AboutPreview />
      <MenuHighlights categories={categories} />
      <GalleryPreview />
      <WhyVisit />
      {reviews.length > 0 && <ReviewsSection reviews={reviews} />}
      <Reveal>
        <nav
          aria-label="Call to action"
          className="border-t border-border"
        >
          <div className="container-site flex flex-col items-start justify-between gap-6 py-14 md:flex-row md:items-center md:py-16">
            <h2 className="heading-display text-balance max-w-md text-3xl md:text-4xl">
              The tandoor is already hot.
            </h2>
            <Link href="/menu" className={cn(buttonVariants({ size: "lg" }), "group shrink-0")}>
              See today&apos;s menu
              <ArrowRight
                className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
          </div>
        </nav>
      </Reveal>
    </main>
  );
}
