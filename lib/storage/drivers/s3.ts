import "server-only";

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import type { PutObjectInput, PutObjectResult, StorageDriver } from "../types";

export interface S3DriverConfig {
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** `auto` is accepted by R2; AWS uses a real region such as `ap-south-1`. */
  region: string;
  /** Custom endpoint for R2 / MinIO / Backblaze. Omit for AWS S3. */
  endpoint?: string;
  /** Public base URL objects are served from, without a trailing slash. */
  publicUrl: string;
  /** Required by MinIO and some S3-compatible providers. */
  forcePathStyle: boolean;
}

const DEFAULT_CACHE_CONTROL = "public, max-age=31536000, immutable";

/**
 * S3-compatible driver — works with AWS S3, Cloudflare R2, MinIO and
 * Backblaze B2, so the same code serves both Vercel and self-hosted deploys.
 */
export function createS3Driver(config: S3DriverConfig): StorageDriver {
  const client = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  const baseUrl = config.publicUrl.replace(/\/+$/, "");

  return {
    name: "s3",
    async putObject({
      key,
      body,
      contentType,
      cacheControl,
    }: PutObjectInput): Promise<PutObjectResult> {
      await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          CacheControl: cacheControl ?? DEFAULT_CACHE_CONTROL,
        })
      );

      return { key, url: `${baseUrl}/${key}`, driver: "s3" };
    },
  };
}
