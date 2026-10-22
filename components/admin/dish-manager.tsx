"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Pencil, Plus, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, StatusMessage, controlClass, mapServerError, type FieldErrors } from "@/components/admin/form-field";
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
  canCreate = true,
  canEdit = true,
  canDelete,
}: {
  dishes: AdminDishRow[];
  categories: AdminCategoryOption[];
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<AdminDishRow | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [deleting, setDeleting] = React.useState<AdminDishRow | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});
  // Optimistic overrides for the quick toggles, rolled back on failure.
  const [overrides, setOverrides] = React.useState<Record<string, { isAvailable?: boolean; isFeatured?: boolean }>>({});

  const modalOpen = creating || editing !== null;

  function closeModal() {
    setCreating(false);
    setEditing(null);
    setFieldErrors({});
    setError(null);
  }

  function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const data = new FormData(event.currentTarget);
    const errors: FieldErrors = {};
    const name = String(data.get("name") ?? "").trim();
    const price = Number(data.get("price"));
    if (name.length < 2) errors.name = "Enter a dish name of at least 2 characters.";
    if (!data.get("categoryId")) errors.categoryId = "Please choose a category.";
    if (!(price >= 1)) errors.price = "Enter a price of at least 1.";
    if (String(data.get("description") ?? "").trim().length < 10) {
      errors.description = "Describe the dish in at least 10 characters.";
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError("Please fix the highlighted fields.");
      return;
    }
    setError(null);

    startTransition(async () => {
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

      if (!result.ok) {
        const message = result.error ?? "Could not save the dish.";
        setError(message);
        setFieldErrors(
          mapServerError(message, [
            [/name is already used|dish name|name/i, "name"],
            [/category/i, "categoryId"],
            [/compare/i, "compareAtPrice"],
            [/price/i, "price"],
            [/description/i, "description"],
          ])
        );
        return;
      }

      setNotice(editing ? "Dish saved." : "Dish created.");
      closeModal();
      router.refresh();
    });
  }

  function handleDelete() {
    if (!deleting || pending) return;
    const target = deleting;
    startTransition(async () => {
      const result = await deleteDishAction(target.id);
      if (!result.ok) {
        setError(result.error ?? "Could not delete the dish.");
        setDeleting(null);
        return;
      }
      setNotice(`${target.name} deleted.`);
      setDeleting(null);
      router.refresh();
    });
  }

  function handleToggle(dish: AdminDishRow, key: "isAvailable" | "isFeatured") {
    const next = !(overrides[dish.id]?.[key] ?? dish[key]);
    const previous = overrides[dish.id];
    setError(null);
    setNotice(null);
    setOverrides((o) => ({ ...o, [dish.id]: { ...o[dish.id], [key]: next } }));
    startTransition(async () => {
      const result =
        key === "isAvailable"
          ? await toggleDishAvailabilityAction(dish.id, next)
          : await toggleDishFeaturedAction(dish.id, next);
      if (!result.ok) {
        setOverrides((o) => ({ ...o, [dish.id]: previous ?? {} }));
        setError(result.error ?? "Could not update the dish.");
        return;
      }
      setNotice("Dish updated.");
      router.refresh();
    });
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
        {canCreate ? (
          <Button
            onClick={() => {
              setError(null);
              setNotice(null);
              setEditing(null);
              setCreating(true);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            New dish
          </Button>
        ) : null}
      </div>

      {!modalOpen ? <StatusMessage ok={notice} error={error} /> : null}

      {dishes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
          <p className="heading-display text-xl">No dishes yet</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {canCreate
              ? "Select New dish above to add your first dish. If you just applied filters, clear them to see everything."
              : "No dishes match. Ask an editor or admin to add the first dish."}
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
              {dishes.map((row) => {
                const dish = { ...row, ...overrides[row.id] };
                return (
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
                        disabled={!canEdit || pending}
                        onClick={() => handleToggle(row, "isAvailable")}
                        aria-pressed={dish.isAvailable}
                        className="cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                        title={canEdit ? "Toggle availability" : "You do not have permission to edit dishes"}
                      >
                        <Badge variant={dish.isAvailable ? "success" : "secondary"}>
                          {dish.isAvailable ? "Available" : "Hidden"}
                        </Badge>
                      </button>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {canEdit ? (
                          <>
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => handleToggle(row, "isFeatured")}
                              aria-pressed={dish.isFeatured}
                              title={dish.isFeatured ? "Remove from featured" : "Mark as featured"}
                              className={cn(
                                "rounded-lg p-2 transition-colors hover:bg-muted disabled:opacity-60",
                                dish.isFeatured ? "text-primary" : "text-muted-foreground"
                              )}
                            >
                              <Star className={cn("h-4 w-4", dish.isFeatured && "fill-current")} />
                              <span className="sr-only">Toggle featured for {dish.name}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setError(null);
                                setNotice(null);
                                setCreating(false);
                                setEditing(row);
                              }}
                              title="Edit dish"
                              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            >
                              <Pencil className="h-4 w-4" />
                              <span className="sr-only">Edit {dish.name}</span>
                            </button>
                          </>
                        ) : null}
                        {canDelete ? (
                          <button
                            type="button"
                            onClick={() => setDeleting(row)}
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
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={closeModal} title={editing ? `Edit ${editing.name}` : "New dish"}>
        <form key={editing?.id ?? "new"} onSubmit={handleSave} noValidate className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="dish-name" label="Dish name" required error={fieldErrors.name}>
              {(p) => (
                <Input {...p} name="name" className="bg-background" maxLength={120} defaultValue={editing?.name ?? ""} />
              )}
            </Field>
            <Field id="dish-category" label="Category" required error={fieldErrors.categoryId}>
              {(p) => (
                <select {...p} name="categoryId" defaultValue={editing?.categoryId ?? ""} className={cn(controlClass, "h-11")}>
                  <option value="" disabled>
                    Choose a category
                  </option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="dish-price" label="Price (INR)" required error={fieldErrors.price}>
              {(p) => (
                <Input
                  {...p}
                  name="price"
                  type="number"
                  step="0.01"
                  min="1"
                  max="99999"
                  className="bg-background"
                  defaultValue={editing ? String(editing.price) : ""}
                />
              )}
            </Field>
            <Field id="dish-compare" label="Compare at (INR)" error={fieldErrors.compareAtPrice}>
              {(p) => (
                <Input
                  {...p}
                  name="compareAtPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  max="99999"
                  className="bg-background"
                  defaultValue={editing?.compareAtPrice != null ? String(editing.compareAtPrice) : ""}
                />
              )}
            </Field>
            <Field id="dish-sort" label="Sort order" error={fieldErrors.sortOrder}>
              {(p) => (
                <Input
                  {...p}
                  name="sortOrder"
                  type="number"
                  min="0"
                  max="9999"
                  className="bg-background"
                  defaultValue={editing ? String(editing.sortOrder) : "0"}
                />
              )}
            </Field>
          </div>

          <Field id="dish-short" label="Short description" error={fieldErrors.shortDescription}>
            {(p) => (
              <Input
                {...p}
                name="shortDescription"
                maxLength={200}
                className="bg-background"
                placeholder="One line shown on the menu"
                defaultValue={editing?.shortDescription ?? ""}
              />
            )}
          </Field>

          <Field id="dish-description" label="Full description" required error={fieldErrors.description}>
            {(p) => (
              <Textarea
                {...p}
                name="description"
                maxLength={2000}
                rows={4}
                className="bg-background"
                defaultValue={editing?.description ?? ""}
              />
            )}
          </Field>

          <div className="space-y-1.5">
            <span className="block text-sm font-medium">Dish photography</span>
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
            <Field id="dish-prep" label="Prep time (min)" error={fieldErrors.preparationTime}>
              {(p) => (
                <Input {...p} name="preparationTime" type="number" min="1" max="480" className="bg-background" defaultValue={editing?.preparationTime ?? ""} />
              )}
            </Field>
            <Field id="dish-calories" label="Calories" error={fieldErrors.calories}>
              {(p) => (
                <Input {...p} name="calories" type="number" min="1" max="5000" className="bg-background" defaultValue={editing?.calories ?? ""} />
              )}
            </Field>
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

          <StatusMessage error={error} />

          <div className="sticky bottom-0 -mx-6 mt-6 flex justify-end gap-3 border-t border-border bg-card px-6 py-4">
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : editing ? "Save changes" : "Create dish"}
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
            {pending ? "Deleting..." : "Delete dish"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
