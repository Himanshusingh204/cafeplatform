"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { X, Plus, Minus, Trash2, ShoppingBag, ArrowRight, Clock } from "lucide-react";
import { useCart } from "@/hooks/use-cart";
import { formatPrice } from "@/lib/utils/format";
import { SlideDrawer } from "@/components/ui/motion";

export function CartDrawer() {
  const { items, isOpen, closeCart, updateQuantity, removeItem, subtotal, totalCount } = useCart();

  return (
    <SlideDrawer isOpen={isOpen} onClose={closeCart} title="Your Takeaway Bag">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ShoppingBag className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-medium text-foreground">Takeaway Bag</h2>
            <p className="text-xs text-muted-foreground">{totalCount} items selected</p>
          </div>
        </div>
        <button
          onClick={closeCart}
          aria-label="Close cart"
          className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Body */}
      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
            <ShoppingBag className="h-8 w-8" />
          </div>
          <p className="heading-display mt-4 text-xl">Your bag is empty</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add hot rotis, tandoori grills, and slow-cooked curries to get started.
          </p>
          <button
            onClick={closeCart}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90"
          >
            Browse Menu
          </button>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto divide-y divide-border px-6">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-4 py-4">
                {item.image ? (
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                    <Image
                      src={item.image}
                      alt={item.name}
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground">
                    <ShoppingBag className="h-6 w-6" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-medium text-foreground">{item.name}</h3>
                  <p className="text-xs font-semibold text-primary">{formatPrice(item.price)}</p>

                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex items-center rounded-md border border-border bg-background">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        aria-label="Decrease quantity"
                        className="p-1 text-muted-foreground hover:text-foreground"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-7 text-center text-xs font-medium">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        aria-label="Increase quantity"
                        className="p-1 text-muted-foreground hover:text-foreground"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <button
                      onClick={() => removeItem(item.id)}
                      aria-label="Remove item"
                      className="p-1 text-muted-foreground transition-colors hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="text-right text-sm font-semibold text-foreground">
                  {formatPrice(item.price * item.quantity)}
                </div>
              </div>
            ))}
          </div>

          {/* Footer & Checkout CTA */}
          <div className="border-t border-border bg-muted/30 p-6 space-y-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5 text-primary" />
              <span>Prepared fresh in approximately 25–30 minutes</span>
            </div>

            <div className="flex items-baseline justify-between border-t border-border/60 pt-3">
              <span className="text-sm text-muted-foreground">Subtotal</span>
              <span className="heading-display text-2xl font-bold text-foreground">
                {formatPrice(subtotal)}
              </span>
            </div>

            <Link
              href="/checkout"
              onClick={closeCart}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-md transition-all hover:bg-primary/90 hover:shadow-lg active:scale-[0.99]"
            >
              <span>Proceed to Takeaway Details</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </>
      )}
    </SlideDrawer>
  );
}
