import "server-only";

import { randomBytes } from "node:crypto";
import sharp from "sharp";

/**
 * Accepted image formats, mapped to their canonical file extension.
 * The declared `Content-Type` from the client is never trusted on its own —
 * see `sniffImageType`.
 */
export const ALLOWED_IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
} as const;

export type AllowedImageType = keyof typeof ALLOWED_IMAGE_TYPES;

/** Hard upload ceiling. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

/** Longest edge we accept, to bound decode cost and reject decompression bombs. */
export const MAX_UPLOAD_DIMENSION = 8_000;

interface Signature {
  type: AllowedImageType;
  offset: number;
  bytes: number[];
}

const SIGNATURES: Signature[] = [
  { type: "image/jpeg", offset: 0, bytes: [0xff, 0xd8, 0xff] },
  { type: "image/png", offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { type: "image/webp", offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] }, // "RIFF"
  { type: "image/avif", offset: 4, bytes: [0x66, 0x74, 0x79, 0x70] }, // "ftyp"
];

/**
 * Identify an image by its leading bytes. Returns null for anything that is not
 * a supported raster image, regardless of what the client claimed.
 */
export function sniffImageType(buffer: Buffer): AllowedImageType | null {
  for (const signature of SIGNATURES) {
    if (buffer.length < signature.offset + signature.bytes.length) continue;

    let matches = true;
    for (let i = 0; i < signature.bytes.length; i += 1) {
      if (buffer[signature.offset + i] !== signature.bytes[i]) {
        matches = false;
        break;
      }
    }
    if (!matches) continue;

    // "RIFF" alone is also WAV/AVI — require the WEBP fourcc at byte 8.
    if (signature.type === "image/webp") {
      if (buffer.toString("ascii", 8, 12) !== "WEBP") continue;
    }

    // "ftyp" alone is also MP4/HEIC — require an AVIF brand at byte 8.
    if (signature.type === "image/avif") {
      const brand = buffer.toString("ascii", 8, 12);
      if (brand !== "avif" && brand !== "avis") continue;
    }

    return signature.type;
  }

  return null;
}

export interface ProcessedImage {
  body: Buffer;
  contentType: AllowedImageType;
  extension: string;
  width: number;
  height: number;
}

export type ProcessUploadResult =
  | { ok: true; image: ProcessedImage }
  | { ok: false; error: string };

/**
 * Validate and normalise an uploaded image.
 *
 * Defence in depth: enforce the size cap, confirm the magic bytes match a
 * supported format, confirm the declared type agrees, prove the bytes actually
 * decode as an image, and re-encode the decoded pixels. Re-encoding strips
 * EXIF/GPS metadata and any payload smuggled into a metadata segment, and bakes
 * in the EXIF orientation.
 */
export async function processUpload(
  input: Buffer,
  declaredType: string
): Promise<ProcessUploadResult> {
  if (input.length === 0) {
    return { ok: false, error: "The uploaded file is empty." };
  }

  if (input.length > MAX_UPLOAD_BYTES) {
    const limitMb = Math.round(MAX_UPLOAD_BYTES / (1024 * 1024));
    return { ok: false, error: `Image exceeds the ${limitMb}MB size limit.` };
  }

  const sniffed = sniffImageType(input);
  if (!sniffed) {
    return { ok: false, error: "Unsupported file. Allowed formats: JPG, PNG, WebP, AVIF." };
  }

  if (declaredType && declaredType !== sniffed) {
    return { ok: false, error: "The file contents do not match the declared image type." };
  }

  try {
    const metadata = await sharp(input, {
      limitInputPixels: MAX_UPLOAD_DIMENSION * MAX_UPLOAD_DIMENSION,
    }).metadata();

    if (!metadata.width || !metadata.height) {
      return { ok: false, error: "The uploaded file is not a readable image." };
    }

    if (metadata.width > MAX_UPLOAD_DIMENSION || metadata.height > MAX_UPLOAD_DIMENSION) {
      return {
        ok: false,
        error: `Image dimensions exceed the ${MAX_UPLOAD_DIMENSION}px limit.`,
      };
    }

    const body = await sharp(input).rotate().toBuffer();

    return {
      ok: true,
      image: {
        body,
        contentType: sniffed,
        extension: ALLOWED_IMAGE_TYPES[sniffed],
        width: metadata.width,
        height: metadata.height,
      },
    };
  } catch {
    return { ok: false, error: "The uploaded file could not be decoded as an image." };
  }
}

function sanitizeSegment(segment: string): string {
  const cleaned = segment
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");
  return cleaned || "uploads";
}

/**
 * Build a collision-resistant, path-traversal-safe object key:
 * `<folder>/<YYYYMMDD>-<16 hex>.<ext>`.
 */
export function buildStorageKey(folder: string, extension: string): string {
  const safeFolder = sanitizeSegment(folder);
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const id = randomBytes(8).toString("hex");
  return `${safeFolder}/${stamp}-${id}.${extension}`;
}
