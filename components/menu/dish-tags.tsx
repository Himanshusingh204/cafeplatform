import { Leaf, Flame, Nut } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function DishTags({
  isVegetarian,
  isVegan,
  isSpicy,
  containsNuts,
}: {
  isVegetarian: boolean;
  isVegan: boolean;
  isSpicy: boolean;
  containsNuts: boolean;
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {isVegetarian ? (
        <Badge variant="success">
          <Leaf className="h-3 w-3" aria-hidden="true" />
          Veg
        </Badge>
      ) : null}
      {isVegan ? (
        <Badge variant="success">
          <Leaf className="h-3 w-3" aria-hidden="true" />
          Vegan
        </Badge>
      ) : null}
      {isSpicy ? (
        <Badge variant="danger">
          <Flame className="h-3 w-3" aria-hidden="true" />
          Spicy
        </Badge>
      ) : null}
      {containsNuts ? (
        <Badge variant="outline">
          <Nut className="h-3 w-3" aria-hidden="true" />
          Contains nuts
        </Badge>
      ) : null}
    </span>
  );
}