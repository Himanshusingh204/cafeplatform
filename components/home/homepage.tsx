import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/ui/reveal";
import { Hero } from "@/components/home/hero";
import { FeaturedDishes } from "@/components/home/featured-dishes";
import { AboutPreview } from "@/components/home/about-preview";
import { MenuHighlights } from "@/components/home/menu-highlights";
import { GalleryPreview } from "@/components/home/gallery-preview";
import { WhyVisit } from "@/components/home/why-visit";
import { buttonVariants } from "@/components/ui/button";
import { getMenu } from "@/lib/services/menu";
import { cn } from "@/lib/utils/cn";

export default async function HomePage() {
  const categories = await getMenu();
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
      <Reveal>
        <nav aria-label="Call to action" className="container-site pb-20 pt-4 text-center">
          <Link href="/menu" className={cn(buttonVariants({ size: "lg" }), "group")}>
            Explore the full menu
            <ArrowRight
              className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
        </nav>
      </Reveal>
    </main>
  );
}
