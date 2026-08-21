import Image from "next/image";
import Link from "next/link";
import { Clock } from "lucide-react";
import { formatPrice } from "@/lib/utils/format";
import { DishTags } from "@/components/menu/dish-tags";
import type { PublicDish } from "@/lib/services/menu";

export function DishCard({ dish }: { dish: PublicDish }) {
  return (
    <Link
      href={`/menu/${dish.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card-hover"
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <Image
          src={dish.image ?? "/images/placeholders/dish-placeholder.jpg"}
          alt={dish.name}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>
      <div className="flex flex-1 flex-col gap-2.5 p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="heading-display text-lg">{dish.name}</h3>
          <span className="whitespace-nowrap text-lg font-semibold text-foreground">
            {formatPrice(dish.price)}
          </span>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">{dish.shortDescription}</p>
        <div className="mt-auto flex items-center justify-between pt-2">
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
      </div>
    </Link>
  );
}