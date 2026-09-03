"use client";

import * as React from "react";
import Image from "next/image";
import { UploadCloud, ImagePlus, CheckCircle2, AlertCircle, X, Loader2, Link2 } from "lucide-react";
import { Input } from "@/components/ui/input";

interface ImageUploaderProps {
  name?: string;
  defaultValue?: string;
  folder?: "gallery" | "dishes";
  presetImages?: Array<{ name: string; path: string }>;
  onUploaded?: (url: string) => void;
}

export function ImageUploader({
  name = "imageUrl",
  defaultValue = "",
  folder = "gallery",
  presetImages = [],
  onUploaded,
}: ImageUploaderProps) {
  const [imageUrl, setImageUrl] = React.useState(defaultValue);
  const [prevDefaultValue, setPrevDefaultValue] = React.useState(defaultValue);
  const [isUploading, setIsUploading] = React.useState(false);
  const [dragActive, setDragActive] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [mode, setMode] = React.useState<"upload" | "url">("upload");
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  if (defaultValue !== prevDefaultValue) {
    setPrevDefaultValue(defaultValue);
    setImageUrl(defaultValue);
  }

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file (JPG, PNG, WebP, AVIF).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image file exceeds the 5MB size limit.");
      return;
    }

    setError(null);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", folder);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "Failed to upload image.");
      } else {
        setImageUrl(data.url);
        onUploaded?.(data.url);
      }
    } catch {
      setError("An unexpected network error occurred during upload.");
    } finally {
      setIsUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

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

  return (
    <div className="space-y-3">
      {/* Hidden input storing the value for form submission */}
      <input type="hidden" name={name} value={imageUrl} />

      {/* Tabs: Device Upload vs URL */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5 rounded-lg border border-border bg-muted/30 p-1">
          <button
            type="button"
            onClick={() => setMode("upload")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-all ${
              mode === "upload"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <UploadCloud className="h-3.5 w-3.5" />
            Upload Device Photo
          </button>
          <button
            type="button"
            onClick={() => setMode("url")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-all ${
              mode === "url"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Link2 className="h-3.5 w-3.5" />
            Paste Path / Presets
          </button>
        </div>

        {imageUrl && (
          <button
            type="button"
            onClick={() => setImageUrl("")}
            className="text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
          >
            <X className="h-3 w-3" /> Clear Photo
          </button>
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {mode === "upload" ? (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`relative flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-all ${
            dragActive
              ? "border-primary bg-primary/5 scale-[0.99]"
              : imageUrl
              ? "border-border bg-muted/20 hover:border-primary/50"
              : "border-border bg-muted/30 hover:border-primary/50 hover:bg-muted/50"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            onChange={(e) => {
              if (e.target.files?.[0]) {
                handleFile(e.target.files[0]);
              }
            }}
            className="hidden"
          />

          {isUploading ? (
            <div className="flex flex-col items-center gap-2 py-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-xs font-medium text-foreground">Uploading image to server...</p>
              <p className="text-[11px] text-muted-foreground">Optimizing storage...</p>
            </div>
          ) : imageUrl ? (
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="relative h-24 w-32 shrink-0 overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                <Image
                  src={imageUrl}
                  alt="Uploaded preview"
                  fill
                  sizes="128px"
                  className="object-cover"
                />
              </div>
              <div className="text-left space-y-1">
                <div className="flex items-center gap-1.5 text-success text-xs font-semibold">
                  <CheckCircle2 className="h-4 w-4" />
                  Image Uploaded
                </div>
                <p className="text-xs font-mono text-muted-foreground truncate max-w-[220px]">
                  {imageUrl}
                </p>
                <p className="text-[11px] text-primary hover:underline">
                  Click or drag another image to replace
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <ImagePlus className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">
                  Click to upload or drag & drop image
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  JPG, PNG, WebP or AVIF (Up to 5MB)
                </p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <Input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="/images/gallery/interior-01.jpg"
            maxLength={500}
          />

          {presetImages.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Quick pick existing photography:</p>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto rounded-md border border-border/60 bg-muted/30 p-2">
                {presetImages.map((item) => (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => setImageUrl(item.path)}
                    className="flex items-center gap-1.5 rounded border border-border bg-card px-2 py-1 text-xs hover:border-primary hover:text-primary transition-colors"
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
