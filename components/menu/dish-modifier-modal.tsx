"use client";

import * as React from "react";
import Image from "next/image";
import { Modal } from "@/components/ui/modal";
import { formatPrice } from "@/lib/utils/format";
import { useCart, CartModifierSelection } from "@/hooks/use-cart";
import type { PublicDish, PublicModifierGroup } from "@/lib/services/menu";

interface DishModifierModalProps {
  dish: PublicDish | null;
  isOpen: boolean;
  onClose: () => void;
}

function getInitialSelections(dish: PublicDish): Record<string, string[]> {
  const initial: Record<string, string[]> = {};
  if (!dish.modifierGroups) return initial;

  dish.modifierGroups.forEach((group) => {
    if (group.minSelect === 1 && group.maxSelect === 1 && group.options.length > 0) {
      initial[group.id] = [group.options[0].id];
    } else {
      initial[group.id] = [];
    }
  });

  return initial;
}

interface DishModifierFormProps {
  dish: PublicDish;
  onClose: () => void;
}

function DishModifierForm({ dish, onClose }: DishModifierFormProps) {
  const { addItem } = useCart();
  const [selections, setSelections] = React.useState<Record<string, string[]>>(() =>
    getInitialSelections(dish)
  );
  const [quantity, setQuantity] = React.useState(1);

  const groups: PublicModifierGroup[] = dish.modifierGroups || [];

  const handleSelect = (group: PublicModifierGroup, optionId: string) => {
    setSelections((prev) => {
      const current = prev[group.id] || [];

      if (group.maxSelect === 1) {
        return { ...prev, [group.id]: [optionId] };
      }

      if (current.includes(optionId)) {
        return { ...prev, [group.id]: current.filter((id) => id !== optionId) };
      }

      if (current.length < group.maxSelect) {
        return { ...prev, [group.id]: [...current, optionId] };
      }

      return prev;
    });
  };

  const isSatisfied = groups.every((group) => {
    const selected = selections[group.id] || [];
    return selected.length >= group.minSelect;
  });

  const selectedModifiersList: CartModifierSelection[] = [];
  let modifiersExtra = 0;

  groups.forEach((group) => {
    const selectedIds = selections[group.id] || [];
    group.options.forEach((opt) => {
      if (selectedIds.includes(opt.id)) {
        modifiersExtra += opt.priceDelta;
        selectedModifiersList.push({
          groupId: group.id,
          groupName: group.name,
          optionId: opt.id,
          optionName: opt.name,
          priceDelta: opt.priceDelta,
        });
      }
    });
  });

  const unitPrice = dish.price + modifiersExtra;
  const totalPrice = unitPrice * quantity;

  const handleAddToCart = () => {
    if (!isSatisfied) return;

    addItem(
      {
        id: dish.id,
        dishId: dish.id,
        name: dish.name,
        slug: dish.slug,
        price: unitPrice,
        image: dish.image,
        modifiers: selectedModifiersList,
      },
      quantity
    );

    onClose();
  };

  return (
    <div className="space-y-6">
      {dish.image && (
        <div className="relative h-48 w-full overflow-hidden rounded-xl">
          <Image src={dish.image} alt={dish.name} fill className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-black/30" />
        </div>
      )}

      <div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {dish.description || dish.shortDescription}
        </p>
        <div className="mt-2 text-lg font-semibold text-primary font-mono">
          {formatPrice(dish.price)}
        </div>
      </div>

      {/* Modifier Groups */}
      <div className="space-y-6 divide-y divide-border">
        {groups.map((group) => {
          const selected = selections[group.id] || [];
          const isRequired = group.minSelect > 0;

          return (
            <div key={group.id} className="pt-4 first:pt-0 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-foreground text-sm tracking-wide">
                    {group.name}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    {group.maxSelect === 1
                      ? isRequired
                        ? "Select 1 (Required)"
                        : "Select up to 1"
                      : `Choose up to ${group.maxSelect}${isRequired ? ` (Min ${group.minSelect})` : ""}`}
                  </p>
                </div>
                {isRequired && (
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/30">
                    Required
                  </span>
                )}
              </div>

              <div className="space-y-2">
                {group.options.map((option) => {
                  const isChecked = selected.includes(option.id);

                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleSelect(group, option.id)}
                      className={`w-full flex items-center justify-between p-3 rounded-xl border text-sm transition-all text-left ${
                        isChecked
                          ? "bg-primary/10 border-primary text-primary"
                          : "bg-muted/40 border-border hover:border-border/80 text-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-4 h-4 rounded-${group.maxSelect === 1 ? "full" : "md"} border flex items-center justify-center transition-colors ${
                            isChecked
                              ? "bg-primary border-primary"
                              : "border-muted-foreground bg-background"
                          }`}
                        >
                          {isChecked && (
                            <div
                              className={`w-1.5 h-1.5 rounded-full ${
                                group.maxSelect === 1 ? "bg-background" : "bg-background"
                              }`}
                            />
                          )}
                        </div>
                        <span className="font-medium">{option.name}</span>
                      </div>

                      <span className="text-xs font-mono text-muted-foreground">
                        {option.priceDelta > 0
                          ? `+${formatPrice(option.priceDelta)}`
                          : "Included"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Quantity Controls & Add to Cart */}
      <div className="pt-4 border-t border-border flex items-center justify-between gap-4">
        <div className="flex items-center border border-border rounded-xl bg-muted/40">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="px-3.5 py-2 text-muted-foreground hover:text-foreground font-bold text-base"
          >
            −
          </button>
          <span className="px-3 py-2 text-sm font-semibold font-mono text-foreground">
            {quantity}
          </span>
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.min(20, q + 1))}
            className="px-3.5 py-2 text-muted-foreground hover:text-foreground font-bold text-base"
          >
            +
          </button>
        </div>

        <button
          type="button"
          disabled={!isSatisfied}
          onClick={handleAddToCart}
          className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3 px-4 rounded-xl shadow-md transition-all disabled:opacity-50 flex items-center justify-center text-sm"
        >
          Add to Bag • {formatPrice(totalPrice)}
        </button>
      </div>
    </div>
  );
}

export function DishModifierModal({ dish, isOpen, onClose }: DishModifierModalProps) {
  if (!dish) return null;

  return (
    <Modal open={isOpen} onClose={onClose} title={dish.name} wide>
      <DishModifierForm key={dish.id} dish={dish} onClose={onClose} />
    </Modal>
  );
}
