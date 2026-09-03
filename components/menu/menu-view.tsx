"use client";

import * as React from "react";
import Link from "next/link";
import { Clock, Flame, Grid, LayoutList, Leaf, Search, X } from "lucide-react";
import { DishCard } from "@/components/menu/dish-card";
import { DishTags } from "@/components/menu/dish-tags";
import { formatPrice } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import type { PublicCategory } from "@/lib/services/menu";

type DietaryFilter = "ALL" | "VEG" | "VEGAN" | "SPICY";
type ViewMode = "cards" | "list";

interface MenuViewProps {
  categories: PublicCategory[];
}

export function MenuView({ categories }: MenuViewProps) {
  const [search, setSearch] = React.useState("");
  const [filter, setFilter] = React.useState<DietaryFilter>("ALL");
  const [viewMode, setViewMode] = React.useState<ViewMode>("cards");

  const query = search.trim().toLowerCase();

  // Filter dishes within each category based on search & dietary filter
  const filteredCategories = React.useMemo(() => {
    return categories
      .map((cat) => {
        const matchingDishes = cat.dishes.filter((dish) => {
          // Dietary filter
          if (filter === "VEG" && !dish.isVegetarian) return false;
          if (filter === "VEGAN" && !dish.isVegan) return false;
          if (filter === "SPICY" && !dish.isSpicy) return false;

          // Search query
          if (query) {
            const matchesName = dish.name.toLowerCase().includes(query);
            const matchesDesc = dish.shortDescription.toLowerCase().includes(query);
            const matchesCat = cat.name.toLowerCase().includes(query);
            return matchesName || matchesDesc || matchesCat;
          }

          return true;
        });

        return {
          ...cat,
          dishes: matchingDishes,
        };
      })
      .filter((cat) => cat.dishes.length > 0);
  }, [categories, filter, query]);

  const totalMatches = filteredCategories.reduce((acc, cat) => acc + cat.dishes.length, 0);

  return (
    <div className="space-y-10">
      {/* Controls Bar: Search, Dietary Filters, and View Toggle */}
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-card md:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search dishes, ingredients, spices…"
              className="h-10 w-full rounded-full border border-border bg-background pl-10 pr-9 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 self-end rounded-full border border-border bg-muted/50 p-1 sm:self-auto">
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              aria-label="Grid view with photography"
              title="Visual cards"
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                viewMode === "cards"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Grid className="h-3.5 w-3.5" />
              <span>Photos</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              aria-label="Classic list view"
              title="Classic menu list"
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                viewMode === "list"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutList className="h-3.5 w-3.5" />
              <span>Classic</span>
            </button>
          </div>
        </div>

        {/* Dietary Filters & Category Anchors */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Filter:
            </span>
            <button
              type="button"
              onClick={() => setFilter("ALL")}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                filter === "ALL"
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-background text-muted-foreground hover:text-foreground"
              )}
            >
              All Items
            </button>
            <button
              type="button"
              onClick={() => setFilter("VEG")}
              className={cn(
                "flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                filter === "VEG"
                  ? "bg-success text-white"
                  : "border border-border bg-background text-muted-foreground hover:text-foreground"
              )}
            >
              <Leaf className="h-3 w-3" />
              Vegetarian
            </button>
            <button
              type="button"
              onClick={() => setFilter("VEGAN")}
              className={cn(
                "flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                filter === "VEGAN"
                  ? "bg-emerald-700 text-white"
                  : "border border-border bg-background text-muted-foreground hover:text-foreground"
              )}
            >
              <Leaf className="h-3 w-3" />
              Vegan
            </button>
            <button
              type="button"
              onClick={() => setFilter("SPICY")}
              className={cn(
                "flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                filter === "SPICY"
                  ? "bg-red-600 text-white"
                  : "border border-border bg-background text-muted-foreground hover:text-foreground"
              )}
            >
              <Flame className="h-3 w-3" />
              Spicy
            </button>
          </div>

          {/* Active results counter */}
          {(query || filter !== "ALL") && (
            <span className="text-xs text-muted-foreground">
              Showing {totalMatches} {totalMatches === 1 ? "dish" : "dishes"}
            </span>
          )}
        </div>
      </div>

      {/* Category Jump Anchors */}
      {!query && (
        <nav aria-label="Menu categories" className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <a
              key={category.id}
              href={`#${category.slug}`}
              className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:border-primary hover:text-primary"
            >
              {category.name}
            </a>
          ))}
        </nav>
      )}

      {/* Zero State */}
      {filteredCategories.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center shadow-card">
          <p className="heading-display text-2xl">No matching dishes found</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Try adjusting your search query or dietary filters.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setFilter("ALL");
            }}
            className="mt-5 inline-flex rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Reset filters
          </button>
        </div>
      ) : (
        /* Categories & Dishes Display */
        <div className="space-y-16 md:space-y-20">
          {filteredCategories.map((category) => (
            <section key={category.id} id={category.slug} className="scroll-mt-24">
              <div className="mb-6 max-w-xl">
                <h2 className="heading-display text-3xl md:text-4xl">{category.name}</h2>
                {category.description ? (
                  <p className="mt-2 text-muted-foreground">{category.description}</p>
                ) : null}
              </div>

              {viewMode === "cards" ? (
                /* Visual Cards Grid */
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {category.dishes.map((dish) => (
                    <DishCard key={dish.id} dish={dish} />
                  ))}
                </div>
              ) : (
                /* Classic Menu List with Dotted Leaders */
                <ul className="grid gap-x-12 gap-y-8 lg:grid-cols-2">
                  {category.dishes.map((dish) => (
                    <li key={dish.id}>
                      <Link
                        href={`/menu/${dish.slug}`}
                        className="group block rounded-lg py-1 transition-colors"
                      >
                        <div className="flex items-baseline gap-3">
                          <h3 className="heading-display text-lg group-hover:text-primary">
                            {dish.name}
                          </h3>
                          <span
                            aria-hidden="true"
                            className="mx-1 flex-1 border-b border-dotted border-border group-hover:border-primary/40"
                          />
                          <span className="whitespace-nowrap font-semibold">
                            {formatPrice(dish.price)}
                          </span>
                        </div>
                        <p className="mt-1 max-w-[60ch] text-sm leading-relaxed text-muted-foreground">
                          {dish.shortDescription}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-3">
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
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
