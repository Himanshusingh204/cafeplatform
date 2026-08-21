"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
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

export function GalleryManager({ images }: { images: AdminGalleryRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<AdminGalleryRow | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [deleting, setDeleting] = React.useState<AdminGalleryRow | null>(null);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const modalOpen = creating || editing !== null;

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const data = new FormData(event.currentTarget);
    setPending(true);
    setError(null);

    const result = await saveGalleryImageAction({
      ...(editing ? { id: editing.id } : {}),
      title: data.get("title"),
      altText: data.get("altText"),
      imageUrl: data.get("imageUrl"),
      category: data.get("category"),
      sortOrder: data.get("sortOrder"),
      isPublished: data.get("isPublished") === "on",
    });

    setPending(false);
    if (!result.ok) {
      setError(result.error ?? "Could not save the image.");
      return;
    }

    setCreating(false);
    setEditing(null);
    router.refresh();
  }

  async function handleDelete() {
    if (!deleting || pending) return;
    setPending(true);
    const result = await deleteGalleryImageAction(deleting.id);
    setPending(false);
    if (!result.ok) {
      setError(result.error ?? "Could not delete the image.");
      setDeleting(null);
      return;
    }
    setDeleting(null);
    router.refresh();
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
        <Button
          onClick={() => {
            setError(null);
            setEditing(null);
            setCreating(true);
          }}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add image
        </Button>
      </div>

      {error && !modalOpen ? (
        <p role="alert" className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {images.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
          <p className="heading-display text-xl">No gallery images yet</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Add your first image — place files in public/images/gallery/ and reference the path here.
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
                <div className="flex justify-end gap-1 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
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
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={modalOpen}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        title={editing ? `Edit ${editing.title}` : "Add gallery image"}
      >
        <form onSubmit={handleSave} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="gallery-title">Title *</Label>
              <Input id="gallery-title" name="title" required minLength={2} maxLength={120} defaultValue={editing?.title ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gallery-alt">Alt text * (accessibility &amp; SEO)</Label>
              <Input id="gallery-alt" name="altText" required minLength={2} maxLength={120} defaultValue={editing?.altText ?? ""} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="gallery-url">Image path or URL *</Label>
            <Input
              id="gallery-url"
              name="imageUrl"
              required
              maxLength={500}
              placeholder="/images/gallery/interior-01.jpg"
              defaultValue={editing?.imageUrl ?? ""}
            />
            <p className="text-xs text-muted-foreground">
              Upload files to public/images/gallery/ and paste the path here.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="gallery-category">Category</Label>
              <select
                id="gallery-category"
                name="category"
                defaultValue={editing?.category ?? "ATMOSPHERE"}
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category.charAt(0) + category.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="gallery-sort">Sort order</Label>
              <Input id="gallery-sort" name="sortOrder" type="number" min="0" max="9999" defaultValue={editing ? String(editing.sortOrder) : "0"} />
            </div>
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

          {error ? (
            <p role="alert" className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-3 border-t border-border pt-4">
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
              {pending ? "Saving…" : editing ? "Save changes" : "Add image"}
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
            {pending ? "Deleting…" : "Delete image"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
