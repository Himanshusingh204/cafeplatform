import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { getStorageDriver, isStorageConfigured } from "@/lib/storage";
import { buildStorageKey, processUpload } from "@/lib/storage/image";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_FOLDERS = new Set(["dishes", "gallery", "brand"]);

/**
 * POST /api/upload
 *
 * Admin-only image upload. Bytes are validated by magic number and by decoding
 * them with sharp, re-encoded to strip metadata, then written to the configured
 * object store.
 *
 * There is deliberately NO fallback that inlines the image as a base64 `data:`
 * URL: that corrupted the database with multi-megabyte rows and defeated
 * `next/image`. When storage is not configured the request fails with 503.
 */
export async function POST(req: NextRequest) {
  const admin = await getSession();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isStorageConfigured()) {
    return NextResponse.json(
      {
        error:
          "Image storage is not configured. Set STORAGE_BUCKET, STORAGE_ACCESS_KEY and STORAGE_SECRET_KEY (see .env.example).",
      },
      { status: 503 }
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No image file provided." }, { status: 400 });
    }

    const folderRaw = String(formData.get("folder") ?? "gallery");
    const folder = ALLOWED_FOLDERS.has(folderRaw) ? folderRaw : "gallery";

    const input = Buffer.from(await file.arrayBuffer());
    const processed = await processUpload(input, file.type);
    if (!processed.ok) {
      return NextResponse.json({ error: processed.error }, { status: 400 });
    }

    const driver = getStorageDriver();
    if (!driver) {
      return NextResponse.json({ error: "Image storage is unavailable." }, { status: 503 });
    }

    const { body, contentType, extension, width, height } = processed.image;
    const stored = await driver.putObject({
      key: buildStorageKey(folder, extension),
      body,
      contentType,
    });

    return NextResponse.json({
      success: true,
      url: stored.url,
      key: stored.key,
      driver: stored.driver,
      size: body.length,
      mimeType: contentType,
      width,
      height,
    });
  } catch (error) {
    console.error("Image upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload image. Please try again." },
      { status: 500 }
    );
  }
}
