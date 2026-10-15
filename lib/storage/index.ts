import "server-only";

import type { StorageDriver } from "./types";
import { createLocalDriver } from "./drivers/local";
import { createS3Driver, type S3DriverConfig } from "./drivers/s3";

export type { StorageDriver, PutObjectInput, PutObjectResult, StorageDriverName } from "./types";

export type StorageResolution =
  | { driver: "s3"; config: S3DriverConfig }
  | { driver: "local" }
  | { driver: null };

/**
 * Decide which storage driver a given environment should use.
 *
 * Rules, in order:
 * 1. A complete S3 configuration (bucket + credentials) always wins.
 * 2. `STORAGE_DRIVER=s3` with incomplete config resolves to `null` — it is a
 *    misconfiguration, and silently falling back would hide it.
 * 3. `STORAGE_DRIVER=local`, or any non-production environment, uses the
 *    filesystem driver (dev and tests).
 * 4. Production with nothing configured resolves to `null`, so uploads fail
 *    loudly instead of degrading to a base64 blob stored in the database.
 */
export function resolveStorage(
  env: Record<string, string | undefined> = process.env
): StorageResolution {
  const bucket = env.STORAGE_BUCKET?.trim();
  const accessKeyId = env.STORAGE_ACCESS_KEY?.trim();
  const secretAccessKey = env.STORAGE_SECRET_KEY?.trim();
  const explicit = env.STORAGE_DRIVER?.trim().toLowerCase();

  if (bucket && accessKeyId && secretAccessKey) {
    return {
      driver: "s3",
      config: {
        bucket,
        accessKeyId,
        secretAccessKey,
        region: env.STORAGE_REGION?.trim() || "auto",
        endpoint: env.STORAGE_ENDPOINT?.trim() || undefined,
        publicUrl: env.STORAGE_PUBLIC_URL?.trim() || `https://${bucket}.s3.amazonaws.com`,
        forcePathStyle: env.STORAGE_FORCE_PATH_STYLE === "true",
      },
    };
  }

  if (explicit === "s3") {
    return { driver: null };
  }

  if (explicit === "local" || env.NODE_ENV !== "production") {
    return { driver: "local" };
  }

  return { driver: null };
}

export function isStorageConfigured(
  env: Record<string, string | undefined> = process.env
): boolean {
  return resolveStorage(env).driver !== null;
}

let cachedDriver: StorageDriver | null | undefined;

export function getStorageDriver(
  env: Record<string, string | undefined> = process.env
): StorageDriver | null {
  if (cachedDriver !== undefined) return cachedDriver;

  const resolution = resolveStorage(env);
  if (resolution.driver === "s3") {
    cachedDriver = createS3Driver(resolution.config);
  } else if (resolution.driver === "local") {
    cachedDriver = createLocalDriver();
  } else {
    cachedDriver = null;
  }

  return cachedDriver;
}

/** Reset the memoised driver — used by tests and after a config change. */
export function resetStorageDriverCache(): void {
  cachedDriver = undefined;
}
