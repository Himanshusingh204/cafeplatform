"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Pencil, Plus, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { ImageUploader } from "@/components/admin/image-uploader";
import { formatPrice } from "@/lib/utils/format";
import {
  saveDishAction,
  toggleDishAvailabilityAction,
  toggleDishFeaturedAction,
  deleteDishAction,
} from "@/app/admin/actions/dishes";
import { cn } from "@/lib/utils/cn";

export interface AdminDishRow {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  shortDescription: string;
  description: string;
  price: number;
  compareAtPrice: number | null;
  image: string | null;
  isFeatured: boolean;
  isAvailable: boolean;
  isVegetarian: boolean;
  isVegan: boolean;
  isSpicy: boolean;
  containsNuts: boolean;
  preparationTime: number | null;
  calories: number | null;
  sortOrder: number;
}

export interface AdminCategoryOption {
  id: string;
  name: string;
}

export function DishManager({
  dishes,
  categories,
  canDelete,
}: {
  dishes: AdminDishRow[];
  categories: AdminCategoryOption[];
  canDelete: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<AdminDishRow | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [deleting, setDeleting] = React.useState<AdminDishRow | null>(null);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const modalOpen = creating || editing !== null;

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const data = new FormData(event.currentTarget);
    setPending(true);
    setError(null);

    const result = await saveDishAction({
      ...(editing ? { id: editing.id } : {}),
      name: data.get("name"),
      categoryId: data.get("categoryId"),
      shortDescription: data.get("shortDescription"),
      description: data.get("description"),
      price: data.get("price"),
      compareAtPrice: data.get("compareAtPrice"),
      image: data.get("image"),
      isFeatured: data.get("isFeatured") === "on",
      isAvailable: data.get("isAvailable") === "on",
      isVegetarian: data.get("isVegetarian") === "on",
      isVegan: data.get("isVegan") === "on",
      isSpicy: data.get("isSpicy") === "on",
      containsNuts: data.get("containsNuts") === "on",
      preparationTime: data.get("preparationTime"),
      calories: data.get("calories"),
      sortOrder: data.get("sortOrder"),
    });

    setPending(false);
    if (!result.ok) {
      setError(result.error ?? "Could not save the dish.");
      return;
    }

    setCreating(false);
    setEditing(null);
    router.refresh();
  }

  async function handleDelete() {
    if (!deleting || pending) return;
    setPending(true);
    const result = await deleteDishAction(deleting.id);
    setPending(false);
    if (!result.ok) {
      setError(result.error ?? "Could not delete the dish.");
      return;
    }
    setDeleting(null);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="heading-display text-3xl">Dishes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {dishes.length} {dishes.length === 1 ? "dish" : "dishes"} on the menu.
          </p>
        </div>
        <Button
          onClick={() => {
            setError(null);
            setEditing(null);
            setCreating(true);
          }}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          New dish
        </Button>
      </div>

      {error && !modalOpen ? (
        <p role="alert" className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {dishes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
          <p className="heading-display text-xl">No dishes found</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Adjust the filters above or create your first dish.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="px-5 py-3 font-medium">Dish</th>
                <th scope="col" className="px-5 py-3 font-medium">Category</th>
                <th scope="col" className="px-5 py-3 font-medium">Price</th>
                <th scope="col" className="px-5 py-3 font-medium">Status</th>
                <th scope="col" className="px-5 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {dishes.map((dish) => (
                <tr key={dish.id} className="transition-colors hover:bg-muted/40">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-muted">
                        <Image
                          src={dish.image ?? "/images/placeholders/dish-placeholder.jpg"}
                          alt=""
                          fill
                          sizes="40px"
                          className="object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 font-medium">
                          {dish.name}
                          {dish.isFeatured ? (
                            <Star className="h-3.5 w-3.5 fill-primary text-primary" aria-label="Featured" />
                          ) : null}
                        </p>
                        <p className="max-w-[280px] truncate text-xs text-muted-foreground">
                          {dish.shortDescription}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{dish.categoryName}</td>
                  <td className="px-5 py-3 whitespace-nowrap">{formatPrice(dish.price)}</td>
                  <td className="px-5 py-3">
                    <button
                      type="button"
                      onClick={() =>
                        toggleDishAvailabilityAction(dish.id, !dish.isAvailable)
                          .then(() => router.refresh())
                          .catch(() => setError("Could not update availability."))
                      }
                      aria-pressed={dish.isAvailable}
                      className="cursor-pointer"
                      title="Toggle availability"
                    >
                      <Badge variant={dish.isAvailable ? "success" : "secondary"}>
                        {dish.isAvailable ? "Available" : "Hidden"}
                      </Badge>
                    </button>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          toggleDishFeaturedAction(dish.id, !dish.isFeatured)
                            .then(() => router.refresh())
                            .catch(() => setError("Could not update featured status."))
                        }
                        aria-pressed={dish.isFeatured}
                        title={dish.isFeatured ? "Remove from featured" : "Mark as featured"}
                        className={cn(
                          "rounded-lg p-2 transition-colors hover:bg-muted",
                          dish.isFeatured ? "text-primary" : "text-muted-foreground"
                        )}
                      >
                        <Star className={cn("h-4 w-4", dish.isFeatured && "fill-current")} />
                        <span className="sr-only">Toggle featured</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setError(null);
                          setCreating(false);
                          setEditing(dish);
                        }}
                        title="Edit dish"
                        className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Edit {dish.name}</span>
                      </button>
                      {canDelete ? (
                        <button
                          type="button"
                          onClick={() => setDeleting(dish)}
                          title="Delete dish"
                          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Delete {dish.name}</span>
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        title={editing ? `Edit ${editing.name}` : "New dish"}
      >
        <form key={editing?.id ?? "new"} onSubmit={handleSave} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="dish-name">Dish name *</Label>
              <Input id="dish-name" name="name" required minLength={2} maxLength={120} defaultValue={editing?.name ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dish-category">Category *</Label>
              <select
                id="dish-category"
                name="categoryId"
                required
                defaultValue={editing?.categoryId ?? ""}
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="" disabled>
                  Choose a category…
                </option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="dish-price">Price (₹) *</Label>
              <Input
                id="dish-price"
                name="price"
                type="number"
                step="0.01"
                min="1"
                max="99999"
                required
                defaultValue={editing ? String(editing.price) : ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dish-compare">Compare at (₹)</Label>
              <Input
                id="dish-compare"
                name="compareAtPrice"
                type="number"
                step="0.01"
                min="0"
                max="99999"
                defaultValue={editing?.compareAtPrice != null ? String(editing.compareAtPrice) : ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dish-sort">Sort order</Label>
              <Input id="dish-sort" name="sortOrder" type="number" min="0" max="9999" defaultValue={editing ? String(editing.sortOrder) : "0"} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dish-short">Short description</Label>
            <Input
              id="dish-short"
              name="shortDescription"
              maxLength={200}
              placeholder="One line shown on the menu"
              defaultValue={editing?.shortDescription ?? ""}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dish-description">Full description *</Label>
            <Textarea
              id="dish-description"
              name="description"
              required
              minLength={10}
              maxLength={2000}
              rows={4}
              defaultValue={editing?.description ?? ""}
            />
          </div>

          <div className="space-y-2">
            <Label className="font-medium">Dish Photography</Label>
            <ImageUploader
              name="image"
              defaultValue={editing?.image ?? ""}
              folder="dishes"
              presetImages={[
                { name: "Butter Chicken", path: "/images/menu/butter-chicken.jpg" },
                { name: "Paneer Tikka", path: "/images/menu/paneer-tikka.jpg" },
                { name: "Dal Makhani", path: "/images/menu/dal-makhani.jpg" },
                { name: "Biryani", path: "/images/menu/chicken-biryani.jpg" },
                { name: "Garlic Naan", path: "/images/menu/garlic-naan.jpg" },
                { name: "Lachha Paratha", path: "/images/menu/lachha-paratha.jpg" },
                { name: "Hara Bhara Kebab", path: "/images/menu/hara-bhara-kebab.jpg" },
                { name: "Kulfi Falooda", path: "/images/menu/kulfi-falooda.jpg" },
                { name: "Gulab Jamun", path: "/images/menu/gulab-jamun.jpg" },
                { name: "Masala Chai", path: "/images/menu/masala-chai.jpg" },
                { name: "Cold Coffee", path: "/images/menu/cold-coffee.jpg" },
              ]}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="dish-prep">Prep time (min)</Label>
              <Input id="dish-prep" name="preparationTime" type="number" min="1" max="480" defaultValue={editing?.preparationTime ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dish-calories">Calories</Label>
              <Input id="dish-calories" name="calories" type="number" min="1" max="5000" defaultValue={editing?.calories ?? ""} />
            </div>
          </div>

          <fieldset className="rounded-lg border border-border p-4">
            <legend className="px-1 text-sm font-medium">Dietary tags</legend>
            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-3">
              {(
                [
                  ["isVegetarian", "Vegetarian"],
                  ["isVegan", "Vegan"],
                  ["isSpicy", "Spicy"],
                  ["containsNuts", "Contains nuts"],
                ] as const
              ).map(([name, label]) => (
                <label key={name} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name={name}
                    defaultChecked={editing ? editing[name] : false}
                    className="h-4 w-4 rounded border-border accent-[var(--primary)]"
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-wrap gap-x-8 gap-y-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                name="isAvailable"
                defaultChecked={editing ? editing.isAvailable : true}
                className="h-4 w-4 accent-[var(--primary)]"
              />
              Available on the menu
            </label>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                name="isFeatured"
                defaultChecked={editing ? editing.isFeatured : false}
                className="h-4 w-4 accent-[var(--primary)]"
              />
              Featured on homepage
            </label>
          </div>

          {error ? (
            <p role="alert" className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <div className="sticky bottom-0 -mx-6 mt-6 flex justify-end gap-3 border-t border-border bg-card px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCreating(false);
                setEditing(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : editing ? "Save changes" : "Create dish"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={deleting !== null} onClose={() => setDeleting(null)} title="Delete dish">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Remove <span className="font-medium text-foreground">{deleting?.name}</span> from the menu?
          It will be hidden from the public site. You can recreate it anytime.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={() => setDeleting(null)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={pending}>
            {pending ? "Deleting…" : "Delete dish"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
