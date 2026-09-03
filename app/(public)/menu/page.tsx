import type { Metadata } from "next";
import { Leaf } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { MenuView } from "@/components/menu/menu-view";
import { getMenu } from "@/lib/services/menu";

export const revalidate = 300;

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
            <MenuView categories={categories} />
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
