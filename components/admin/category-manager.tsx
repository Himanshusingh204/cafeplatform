"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, StatusMessage, mapServerError, type FieldErrors } from "@/components/admin/form-field";
import { Textarea } from "@/components/ui/textarea";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { saveCategoryAction, deleteCategoryAction } from "@/app/admin/actions/categories";

export interface AdminCategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  isActive: boolean;
  sortOrder: number;
  dishCount: number;
}

export function CategoryManager({
  categories,
  canCreate = true,
  canEdit = true,
  canDelete,
}: {
  categories: AdminCategoryRow[];
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<AdminCategoryRow | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [deleting, setDeleting] = React.useState<AdminCategoryRow | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});

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
    if (String(data.get("name") ?? "").trim().length < 2) {
      setFieldErrors({ name: "Enter a category name of at least 2 characters." });
      setError("Please fix the highlighted fields.");
      return;
    }
    setFieldErrors({});
    setError(null);

    startTransition(async () => {
      const result = await saveCategoryAction({
        ...(editing ? { id: editing.id } : {}),
        name: data.get("name"),
        description: data.get("description"),
        image: data.get("image"),
        isActive: data.get("isActive") === "on",
        sortOrder: data.get("sortOrder"),
      });

      if (!result.ok) {
        const message = result.error ?? "Could not save the category.";
        setError(message);
        setFieldErrors(mapServerError(message, [[/name/i, "name"], [/image/i, "image"]]));
        return;
      }

      setNotice(editing ? "Category saved." : "Category created.");
      closeModal();
      router.refresh();
    });
  }

  function handleDelete() {
    if (!deleting || pending) return;
    const target = deleting;
    startTransition(async () => {
      const result = await deleteCategoryAction(target.id);
      setDeleting(null);
      if (!result.ok) {
        setError(result.error ?? "Could not delete the category.");
        return;
      }
      setNotice(`${target.name} deleted.`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="heading-display text-3xl">Categories</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sections of your menu, shown in order on the public site.
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
            New category
          </Button>
        ) : null}
      </div>

      {!modalOpen ? <StatusMessage ok={notice} error={error} /> : null}

      {categories.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
          <p className="heading-display text-xl">No categories yet</p>
          <p className="mt-2 text-sm text-muted-foreground">{canCreate ? "Select New category above to add your first one, for example Starters or Mains. Dishes are grouped under categories." : "Ask an editor or admin to add the first category."}</p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {categories.map((category) => (
            <li
              key={category.id}
              className="flex flex-col rounded-xl border border-border bg-card p-5 shadow-card"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="heading-display text-lg">{category.name}</h2>
                  <p className="text-xs text-muted-foreground">/{category.slug}</p>
                </div>
                <Badge variant={category.isActive ? "success" : "secondary"}>
                  {category.isActive ? "Active" : "Hidden"}
                </Badge>
              </div>

              {category.description ? (
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{category.description}</p>
              ) : null}

              <div className="mt-auto flex items-center justify-between pt-4">
                <span className="text-sm text-muted-foreground">
                  {category.dishCount} {category.dishCount === 1 ? "dish" : "dishes"}
                </span>
                <div className="flex items-center gap-1">
                  {canEdit ? (
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setNotice(null);
                        setCreating(false);
                        setEditing(category);
                      }}
                      title="Edit category"
                      className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <Pencil className="h-4 w-4" />
                      <span className="sr-only">Edit {category.name}</span>
                    </button>
                  ) : null}
                  {canDelete ? (
                    <button
                      type="button"
                      onClick={() => setDeleting(category)}
                      title="Delete category"
                      className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Delete {category.name}</span>
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={modalOpen} onClose={closeModal} title={editing ? `Edit ${editing.name}` : "New category"}>
        <form key={editing?.id ?? "new"} onSubmit={handleSave} noValidate className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="category-name" label="Name" required error={fieldErrors.name}>
              {(p) => <Input {...p} name="name" maxLength={120} className="bg-background" defaultValue={editing?.name ?? ""} />}
            </Field>
            <Field id="category-sort" label="Sort order" error={fieldErrors.sortOrder}>
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

          <Field id="category-description" label="Description" error={fieldErrors.description}>
            {(p) => (
              <Textarea
                {...p}
                name="description"
                rows={3}
                maxLength={500}
                className="bg-background"
                placeholder="Shown under the section heading on the menu page"
                defaultValue={editing?.description ?? ""}
              />
            )}
          </Field>

          <Field id="category-image" label="Image path" error={fieldErrors.image} hint="Optional. A site path such as /images/menu/starters.jpg or a full URL.">
            {(p) => (
              <Input {...p} name="image" maxLength={500} className="bg-background" placeholder="/images/menu/starters.jpg" defaultValue={editing?.image ?? ""} />
            )}
          </Field>

          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={editing ? editing.isActive : true}
              className="h-4 w-4 accent-[var(--primary)]"
            />
            Visible on the public menu
          </label>

          <StatusMessage error={error} />

          <div className="sticky bottom-0 -mx-6 mt-6 flex justify-end gap-3 border-t border-border bg-card px-6 py-4">
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : editing ? "Save changes" : "Create category"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={deleting !== null} onClose={() => setDeleting(null)} title="Delete category">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Delete <span className="font-medium text-foreground">{deleting?.name}</span>? Categories with
          dishes cannot be deleted. Move its dishes first.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={() => setDeleting(null)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={pending}>
            {pending ? "Deleting..." : "Delete category"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
