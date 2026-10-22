"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, StatusMessage, controlClass, mapServerError, type FieldErrors } from "@/components/admin/form-field";
import { cn } from "@/lib/utils/cn";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { ImageUploader } from "@/components/admin/image-uploader";
import { saveGalleryImageAction, deleteGalleryImageAction } from "@/app/admin/actions/gallery";

export interface AdminGalleryRow {
  id: string;
  title: string;
  altText: string;
  imageUrl: string;
  category: string;
  sortOrder: number;
  isPublished: boolean;
}

const CATEGORIES = ["INTERIOR", "FOOD", "CHEF", "EVENTS", "ATMOSPHERE"] as const;

export function GalleryManager({ images, canManage = true }: { images: AdminGalleryRow[]; canManage?: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<AdminGalleryRow | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [deleting, setDeleting] = React.useState<AdminGalleryRow | null>(null);
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
    const errors: FieldErrors = {};
    if (String(data.get("title") ?? "").trim().length < 2) errors.title = "Enter a title of at least 2 characters.";
    if (String(data.get("altText") ?? "").trim().length < 2) errors.altText = "Describe the image in at least 2 characters.";
    if (!String(data.get("imageUrl") ?? "").trim()) errors.imageUrl = "Upload an image or provide an image path.";
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError("Please fix the highlighted fields.");
      return;
    }
    setError(null);

    startTransition(async () => {
      const result = await saveGalleryImageAction({
        ...(editing ? { id: editing.id } : {}),
        title: data.get("title"),
        altText: data.get("altText"),
        imageUrl: data.get("imageUrl"),
        category: data.get("category"),
        sortOrder: data.get("sortOrder"),
        isPublished: data.get("isPublished") === "on",
      });

      if (!result.ok) {
        const message = result.error ?? "Could not save the image.";
        setError(message);
        setFieldErrors(mapServerError(message, [[/image path|image url|provide an image/i, "imageUrl"], [/title/i, "title"], [/alt/i, "altText"]]));
        return;
      }

      setNotice(editing ? "Image saved." : "Image added.");
      closeModal();
      router.refresh();
    });
  }

  function handleDelete() {
    if (!deleting || pending) return;
    const target = deleting;
    startTransition(async () => {
      const result = await deleteGalleryImageAction(target.id);
      setDeleting(null);
      if (!result.ok) {
        setError(result.error ?? "Could not delete the image.");
        return;
      }
      setNotice(`${target.title} deleted.`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="heading-display text-3xl">Gallery</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Photographs shown on the public gallery page.
          </p>
        </div>
        {canManage ? (
          <Button
            onClick={() => {
              setError(null);
              setNotice(null);
              setEditing(null);
              setCreating(true);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add image
          </Button>
        ) : null}
      </div>

      {!modalOpen ? <StatusMessage ok={notice} error={error} /> : null}

      {images.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
          <p className="heading-display text-xl">No gallery images yet</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {canManage ? "Select Add image above to upload your first photo, or paste a path to a file in public/images/gallery/." : "Ask an admin or editor to add the first photo."}
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {images.map((image) => (
            <li key={image.id} className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
              <div className="relative aspect-[4/3] bg-muted">
                <Image src={image.imageUrl} alt={image.altText} fill sizes="(max-width: 640px) 100vw, 25vw" className="object-cover" />
              </div>
              <div className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium leading-snug">{image.title}</p>
                  <Badge variant={image.isPublished ? "success" : "secondary"}>
                    {image.isPublished ? "Live" : "Draft"}
                  </Badge>
                </div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {image.category.toLowerCase()} · #{image.sortOrder}
                </p>
                {canManage ? (
                <div className="flex justify-end gap-1 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setNotice(null);
                      setCreating(false);
                      setEditing(image);
                    }}
                    title="Edit image"
                    className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <Pencil className="h-4 w-4" />
                    <span className="sr-only">Edit {image.title}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleting(image)}
                    title="Delete image"
                    className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Delete {image.title}</span>
                  </button>
                </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={modalOpen} onClose={closeModal} title={editing ? `Edit ${editing.title}` : "Add gallery image"}>
        <form key={editing?.id ?? "new"} onSubmit={handleSave} noValidate className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="gallery-title" label="Title" required error={fieldErrors.title}>
              {(p) => <Input {...p} name="title" maxLength={120} className="bg-background" defaultValue={editing?.title ?? ""} />}
            </Field>
            <Field id="gallery-alt" label="Alt text (accessibility and SEO)" required error={fieldErrors.altText}>
              {(p) => <Input {...p} name="altText" maxLength={120} className="bg-background" defaultValue={editing?.altText ?? ""} />}
            </Field>
          </div>

          <div className="space-y-1.5">
            <span className="block text-sm font-medium">
              Gallery photography<span aria-hidden="true" className="text-destructive"> *</span>
            </span>
            <ImageUploader
              id="gallery-image"
              name="imageUrl"
              error={fieldErrors.imageUrl}
              defaultValue={editing?.imageUrl ?? ""}
              folder="gallery"
              presetImages={[
                { name: "Cafe Interior", path: "/images/gallery/interior-01.jpg" },
                { name: "Royal Thali", path: "/images/gallery/thali-spread.jpg" },
                { name: "Tandoor at Work", path: "/images/gallery/tandoor-action.jpg" },
                { name: "Paneer Tikka", path: "/images/gallery/paneer-tikka.jpg" },
                { name: "Dum Biryani", path: "/images/gallery/biryani-handi.jpg" },
                { name: "Cozy Ambiance", path: "/images/gallery/cafe-ambiance.jpg" },
                { name: "Samosa Platter", path: "/images/gallery/samosa-platter.jpg" },
              ]}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="gallery-category" label="Category" error={fieldErrors.category}>
              {(p) => (
                <select {...p} name="category" defaultValue={editing?.category ?? "ATMOSPHERE"} className={cn(controlClass, "h-11")}>
                  {CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category.charAt(0) + category.slice(1).toLowerCase()}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field id="gallery-sort" label="Sort order" error={fieldErrors.sortOrder}>
              {(p) => (
                <Input {...p} name="sortOrder" type="number" min="0" max="9999" className="bg-background" defaultValue={editing ? String(editing.sortOrder) : "0"} />
              )}
            </Field>
          </div>

          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              name="isPublished"
              defaultChecked={editing ? editing.isPublished : true}
              className="h-4 w-4 accent-[var(--primary)]"
            />
            Published on the public gallery
          </label>

          <StatusMessage error={error} />

          <div className="sticky bottom-0 -mx-6 mt-6 flex justify-end gap-3 border-t border-border bg-card px-6 py-4">
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : editing ? "Save changes" : "Add image"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={deleting !== null} onClose={() => setDeleting(null)} title="Delete image">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Delete <span className="font-medium text-foreground">{deleting?.title}</span> permanently?
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={() => setDeleting(null)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={pending}>
            {pending ? "Deleting..." : "Delete image"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
