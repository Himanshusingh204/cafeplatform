"use client";

import * as React from "react";
import Image from "next/image";
import { UploadCloud, ImagePlus, CheckCircle2, AlertCircle, X, Loader2, Link2 } from "lucide-react";
import { Input } from "@/components/ui/input";

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/avif"];

interface ImageUploaderProps {
  name?: string;
  defaultValue?: string;
  folder?: "gallery" | "dishes";
  presetImages?: Array<{ name: string; path: string }>;
  onUploaded?: (url: string) => void;
  /** Id prefix used to bind labels and error text. */
  id?: string;
  /** Validation error from the parent form (for example a missing image). */
  error?: string | null;
}

function uploadWithProgress(
  formData: FormData,
  onProgress: (percent: number) => void
): Promise<{ ok: boolean; data: { success?: boolean; url?: string; error?: string } }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      try {
        resolve({ ok: xhr.status >= 200 && xhr.status < 300, data: JSON.parse(xhr.responseText) });
      } catch {
        resolve({ ok: false, data: { error: "The server returned an unexpected response." } });
      }
    };
    xhr.onerror = () => reject(new Error("network"));
    xhr.onabort = () => reject(new Error("aborted"));
    xhr.send(formData);
  });
}

export function ImageUploader({
  name = "imageUrl",
  defaultValue = "",
  folder = "gallery",
  presetImages = [],
  onUploaded,
  id = "image-uploader",
  error: externalError = null,
}: ImageUploaderProps) {
  const [imageUrl, setImageUrl] = React.useState(defaultValue);
  const [prevDefaultValue, setPrevDefaultValue] = React.useState(defaultValue);
  const [isUploading, setIsUploading] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [dragActive, setDragActive] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [mode, setMode] = React.useState<"upload" | "url">("upload");
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  if (defaultValue !== prevDefaultValue) {
    setPrevDefaultValue(defaultValue);
    setImageUrl(defaultValue);
  }

  const shownError = error ?? externalError;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  async function handleFile(file: File) {
    if (!ACCEPTED.includes(file.type)) {
      setError("That file type is not supported. Choose a JPG, PNG, WebP or AVIF image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(`That file is ${(file.size / (1024 * 1024)).toFixed(1)} MB. The limit is 5 MB.`);
      return;
    }

    setError(null);
    setProgress(0);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", folder);

      const { ok, data } = await uploadWithProgress(formData, setProgress);
      if (!ok || !data.success || !data.url) {
        setError(data.error ?? "Failed to upload image. Please try again.");
      } else {
        setImageUrl(data.url);
        onUploaded?.(data.url);
      }
    } catch {
      setError("A network error interrupted the upload. Check your connection and try again.");
    } finally {
      setIsUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (isUploading) return;

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }

  const tabClass = (active: boolean) =>
    `flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-all ${
      active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
    }`;

  return (
    <div className="space-y-3">
      {/* Hidden input storing the value for form submission */}
      <input type="hidden" name={name} value={imageUrl} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1.5 rounded-lg border border-border bg-muted/30 p-1" role="group" aria-label="Image source">
          <button type="button" aria-pressed={mode === "upload"} onClick={() => setMode("upload")} className={tabClass(mode === "upload")}>
            <UploadCloud className="h-3.5 w-3.5" aria-hidden="true" />
            Upload photo
          </button>
          <button type="button" aria-pressed={mode === "url"} onClick={() => setMode("url")} className={tabClass(mode === "url")}>
            <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
            Paste path or presets
          </button>
        </div>

        {imageUrl && (
          <button
            type="button"
            onClick={() => setImageUrl("")}
            disabled={isUploading}
            className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
          >
            <X className="h-3 w-3" aria-hidden="true" /> Clear photo
          </button>
        )}
      </div>

      <p id={hintId} className="text-xs text-muted-foreground">
        Accepted types: JPG, PNG, WebP or AVIF. Maximum size 5 MB.
      </p>

      {shownError && (
        <div
          id={errorId}
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{shownError}</span>
        </div>
      )}

      {mode === "upload" ? (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`relative flex min-h-[160px] flex-col items-center justify-center rounded-xl border-2 border-dashed p-4 text-center transition-all sm:p-6 ${
            dragActive
              ? "scale-[0.99] border-primary bg-primary/5"
              : imageUrl
                ? "border-border bg-muted/20 hover:border-primary/50"
                : "border-border bg-muted/30 hover:border-primary/50 hover:bg-muted/50"
          }`}
        >
          <input
            ref={fileInputRef}
            id={`${id}-file`}
            type="file"
            accept={ACCEPTED.join(",")}
            aria-label="Choose an image file"
            aria-describedby={[hintId, shownError ? errorId : null].filter(Boolean).join(" ")}
            aria-invalid={shownError ? true : undefined}
            disabled={isUploading}
            onChange={(e) => {
              if (e.target.files?.[0]) handleFile(e.target.files[0]);
              e.target.value = "";
            }}
            className="sr-only"
          />

          {isUploading ? (
            <div className="flex w-full max-w-xs flex-col items-center gap-2 py-4" role="status" aria-live="polite">
              <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
              <p className="text-xs font-medium text-foreground">Uploading... {progress}%</p>
              <div
                className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
                aria-label="Upload progress"
              >
                <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full cursor-pointer flex-col items-center gap-3 rounded-lg p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {imageUrl ? (
                <span className="flex flex-col items-center gap-4 sm:flex-row">
                  <span className="relative block h-24 w-32 shrink-0 overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                    <Image src={imageUrl} alt="Selected image preview" fill sizes="128px" className="object-cover" />
                  </span>
                  <span className="block space-y-1 text-left">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-success">
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      Image ready
                    </span>
                    <span className="block max-w-[220px] truncate font-mono text-xs text-muted-foreground">{imageUrl}</span>
                    <span className="block text-[11px] text-primary">Click or drop another image to replace</span>
                  </span>
                </span>
              ) : (
                <>
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <ImagePlus className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <span className="block">
                    <span className="block text-xs font-semibold text-foreground">Click to upload or drag and drop an image</span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">JPG, PNG, WebP or AVIF, up to 5 MB</span>
                  </span>
                </>
              )}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <label htmlFor={`${id}-url`} className="block text-xs font-medium text-foreground">
            Image path or URL
          </label>
          <Input
            id={`${id}-url`}
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="/images/gallery/interior-01.jpg"
            maxLength={500}
            className="bg-background"
            aria-invalid={shownError ? true : undefined}
            aria-describedby={[hintId, shownError ? errorId : null].filter(Boolean).join(" ")}
          />

          {presetImages.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Quick pick existing photography:</p>
              <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto rounded-md border border-border/60 bg-muted/30 p-2">
                {presetImages.map((item) => (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => setImageUrl(item.path)}
                    className="flex items-center gap-1.5 rounded border border-border bg-card px-2 py-1 text-xs transition-colors hover:border-primary hover:text-primary"
                  >
                    <span className="relative h-4 w-4 shrink-0 overflow-hidden rounded-full">
                      <Image src={item.path} alt="" fill sizes="16px" className="object-cover" />
                    </span>
                    <span>{item.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
