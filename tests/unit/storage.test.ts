import { describe, it, expect } from "vitest";
import { rm, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

import { resolveStorage } from "@/lib/storage";
import { createLocalDriver } from "@/lib/storage/drivers/local";
import {
  buildStorageKey,
  MAX_UPLOAD_BYTES,
  processUpload,
  sniffImageType,
} from "@/lib/storage/image";

async function makePng(): Promise<Buffer> {
  return sharp({
    create: { width: 8, height: 6, channels: 3, background: { r: 200, g: 40, b: 40 } },
  })
    .png()
    .toBuffer();
}

describe("storage — driver resolution", () => {
  it("selects S3 when a bucket and credentials are present", () => {
    const resolution = resolveStorage({
      STORAGE_BUCKET: "cafe-assets",
      STORAGE_ACCESS_KEY: "key",
      STORAGE_SECRET_KEY: "secret",
      STORAGE_REGION: "ap-south-1",
      STORAGE_PUBLIC_URL: "https://cdn.example.com",
    } as Record<string, string | undefined>);

    expect(resolution.driver).toBe("s3");
    if (resolution.driver === "s3") {
      expect(resolution.config.publicUrl).toBe("https://cdn.example.com");
      expect(resolution.config.forcePathStyle).toBe(false);
    }
  });

  it("fails closed in production when nothing is configured", () => {
    expect(resolveStorage({ NODE_ENV: "production" } as Record<string, string | undefined>).driver).toBeNull();
  });

  it("fails closed when S3 is requested but under-configured", () => {
    const resolution = resolveStorage({
      NODE_ENV: "production",
      STORAGE_DRIVER: "s3",
      STORAGE_BUCKET: "only-a-bucket",
    } as Record<string, string | undefined>);
    expect(resolution.driver).toBeNull();
  });

  it("uses the local driver outside production", () => {
    expect(resolveStorage({ NODE_ENV: "test" } as Record<string, string | undefined>).driver).toBe("local");
    expect(resolveStorage({ STORAGE_DRIVER: "local" } as Record<string, string | undefined>).driver).toBe("local");
  });
});

describe("image validation", () => {
  it("sniffs a real PNG from its magic bytes", async () => {
    expect(sniffImageType(await makePng())).toBe("image/png");
  });

  it("accepts a genuine image and returns normalised metadata", async () => {
    const result = await processUpload(await makePng(), "image/png");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.image.contentType).toBe("image/png");
      expect(result.image.extension).toBe("png");
      expect(result.image.width).toBe(8);
      expect(result.image.height).toBe(6);
    }
  });

  it("rejects a non-image payload even when the declared type claims PNG", async () => {
    const result = await processUpload(Buffer.from("#!/bin/sh\necho pwned"), "image/png");
    expect(result.ok).toBe(false);
  });

  it("rejects a file whose declared type disagrees with its bytes", async () => {
    const result = await processUpload(await makePng(), "image/jpeg");
    expect(result.ok).toBe(false);
  });

  it("rejects a file over the size cap", async () => {
    const result = await processUpload(Buffer.alloc(MAX_UPLOAD_BYTES + 1), "image/png");
    expect(result.ok).toBe(false);
  });

  it("rejects an empty file", async () => {
    expect((await processUpload(Buffer.alloc(0), "image/png")).ok).toBe(false);
  });
});

describe("buildStorageKey", () => {
  it("produces a folder-scoped, extension-suffixed key", () => {
    expect(buildStorageKey("gallery", "webp")).toMatch(
      /^gallery\/\d{8}-[0-9a-f]{16}\.webp$/
    );
  });

  it("neutralises path traversal in the folder segment", () => {
    const key = buildStorageKey("../../etc", "png");
    expect(key).not.toContain("..");
    expect(key).not.toContain("/etc/");
    expect(key).toMatch(/^[a-z0-9_-]+\/\d{8}-[0-9a-f]{16}\.png$/);
  });

  it("generates distinct keys", () => {
    expect(buildStorageKey("gallery", "png")).not.toBe(buildStorageKey("gallery", "png"));
  });
});

describe("local driver", () => {
  it("writes the object and returns a public URL", async () => {
    const driver = createLocalDriver();
    const key = buildStorageKey("gallery", "png");

    const result = await driver.putObject({
      key,
      body: await makePng(),
      contentType: "image/png",
    });

    expect(result).toEqual({ key, url: `/uploads/${key}`, driver: "local" });

    const filePath = path.join(process.cwd(), "public", "uploads", key);
    await expect(stat(filePath)).resolves.toBeTruthy();
    await rm(filePath, { force: true });
  });
});
