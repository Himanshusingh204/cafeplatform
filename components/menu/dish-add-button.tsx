"use client";

import * as React from "react";
import { Plus, Minus, ShoppingBag, Check } from "lucide-react";
import { useCart } from "@/hooks/use-cart";
import { formatPrice } from "@/lib/utils/format";

interface DishAddButtonProps {
  dish: {
    id: string;
    name: string;
    slug: string;
    price: number;
    image?: string | null;
  };
}

export function DishAddButton({ dish }: DishAddButtonProps) {
  const { addItem, items } = useCart();
  const [quantity, setQuantity] = React.useState(1);
  const [justAdded, setJustAdded] = React.useState(false);

  const cartItem = items.find((i) => i.id === dish.id);
  const currentQuantityInCart = cartItem?.quantity || 0;

  function handleAddToCart() {
    for (let i = 0; i < quantity; i++) {
      addItem({
        id: dish.id,
        name: dish.name,
        slug: dish.slug,
        price: dish.price,
        image: dish.image,
      });
    }
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 2000);
  }

  return (
    <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-4 border-t border-border pt-6">
      <div className="flex items-center justify-between sm:justify-start rounded-full border border-border bg-card p-1">
        <button
          type="button"
          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
          disabled={quantity <= 1}
          aria-label="Decrease quantity"
          className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted disabled:opacity-30 transition-colors"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="w-10 text-center text-sm font-semibold text-foreground">
          {quantity}
        </span>
        <button
          type="button"
          onClick={() => setQuantity((q) => q + 1)}
          aria-label="Increase quantity"
          className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      <button
        type="button"
        onClick={handleAddToCart}
        className={`flex flex-1 items-center justify-center gap-2 rounded-full py-3 px-6 text-sm font-semibold shadow-sm transition-all duration-200 active:scale-98 ${
          justAdded
            ? "bg-success text-success-foreground"
            : "bg-primary text-primary-foreground hover:bg-primary/90"
        }`}
      >
        {justAdded ? (
          <>
            <Check className="h-4 w-4" />
            <span>Added to Bag!</span>
          </>
        ) : (
          <>
            <ShoppingBag className="h-4 w-4" />
            <span>Add to Bag &bull; {formatPrice(dish.price * quantity)}</span>
          </>
        )}
      </button>

      {currentQuantityInCart > 0 && !justAdded && (
        <span className="text-xs text-muted-foreground text-center sm:text-left self-center">
          ({currentQuantityInCart} in bag)
        </span>
      )}
    </div>
  );
}
