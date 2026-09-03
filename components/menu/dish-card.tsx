"use client";

import Image from "next/image";
import Link from "next/link";
import { Plus } from "lucide-react";
import { formatPrice } from "@/lib/utils/format";
import { DishTags } from "@/components/menu/dish-tags";
import type { PublicDish } from "@/lib/services/menu";
import { useCart } from "@/hooks/use-cart";

export function DishCard({ dish }: { dish: PublicDish }) {
  const { addItem } = useCart();

  function handleAdd(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    addItem({
      id: dish.id,
      name: dish.name,
      slug: dish.slug,
      price: dish.price,
      image: dish.image,
    });
  }

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-card transition-all duration-350 ease-out hover:-translate-y-1 hover:border-primary/35 hover:shadow-card-hover">
      <Link href={`/menu/${dish.slug}`} className="relative aspect-[4/3] overflow-hidden block bg-muted/40">
        <Image
          src={dish.image ?? "/images/placeholders/dish-placeholder.jpg"}
          alt={dish.name}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-106"
        />
      </Link>
      <div className="flex flex-1 flex-col gap-2.5 p-5">
        <div className="flex items-start justify-between gap-3">
          <Link href={`/menu/${dish.slug}`} className="hover:text-primary transition-colors duration-200">
            <h3 className="heading-display text-lg font-semibold tracking-tight">{dish.name}</h3>
          </Link>
          <span className="whitespace-nowrap text-lg font-semibold text-primary">
            {formatPrice(dish.price)}
          </span>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground line-clamp-2">{dish.shortDescription}</p>
        <div className="mt-auto flex items-center justify-between pt-3 border-t border-border/50">
          <DishTags
            isVegetarian={dish.isVegetarian}
            isVegan={dish.isVegan}
            isSpicy={dish.isSpicy}
            containsNuts={dish.containsNuts}
          />

          <button
            onClick={handleAdd}
            aria-label={`Add ${dish.name} to order`}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3.5 py-1.5 text-xs font-semibold text-primary transition-all duration-200 hover:bg-primary hover:text-primary-foreground hover:shadow-xs active:scale-90"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add</span>
          </button>
        </div>
      </div>
    </div>
  );
}