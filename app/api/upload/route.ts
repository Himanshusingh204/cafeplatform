import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

const EXTENSION_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export async function POST(req: NextRequest) {
  const admin = await getSession();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const folder = (formData.get("folder") as string) || "gallery";
    const safeFolder = folder === "dishes" ? "dishes" : "gallery";

    if (!file) {
      return NextResponse.json({ error: "No image file provided." }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Unsupported image format. Allowed formats: JPG, PNG, WebP, AVIF." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "Image file exceeds the 5MB size limit." },
        { status: 400 }
      );
    }

    const ext = EXTENSION_MAP[file.type] || "jpg";
    const uniqueId = crypto.randomBytes(6).toString("hex");
    const filename = `${safeFolder}-${Date.now()}-${uniqueId}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let publicUrl = "";

    // 1. Cloud storage via Vercel Blob if configured
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        const blobModule = "@vercel/blob";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { put } = (await import(blobModule)) as { put: any };
        const blob = await put(`uploads/${safeFolder}/${filename}`, buffer, {
          access: "public",
          contentType: file.type,
        });
        publicUrl = blob.url;
      } catch (blobErr) {
        console.warn("Vercel Blob upload failed, attempting fallback:", blobErr);
      }
    }

    // 2. Local filesystem write if writable
    if (!publicUrl) {
      try {
        const uploadsDir = path.join(process.cwd(), "public", "uploads", safeFolder);
        await mkdir(uploadsDir, { recursive: true });
        const filePath = path.join(uploadsDir, filename);
        await writeFile(filePath, buffer);
        publicUrl = `/uploads/${safeFolder}/${filename}`;
      } catch (fsErr) {
        // 3. Fallback for read-only serverless lambda container
        console.warn("Filesystem read-only on serverless, utilizing data URL fallback:", fsErr);
        publicUrl = `data:${file.type};base64,${buffer.toString("base64")}`;
      }
    }

    return NextResponse.json({
      success: true,
      url: publicUrl,
      filename,
      size: file.size,
      mimeType: file.type,
    });
  } catch (error) {
    console.error("Image upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload image. Please try again." },
      { status: 500 }
    );
  }
}
