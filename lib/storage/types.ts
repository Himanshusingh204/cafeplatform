/**
 * Storage contracts.
 *
 * A driver is a minimal, swappable adapter over an object store. The domain
 * code never imports a vendor SDK directly — it asks `getStorageDriver()` for
 * whatever the deployment is configured with.
 */

export type StorageDriverName = "s3" | "local";

export interface PutObjectInput {
  /** Forward-slash object key, e.g. `gallery/20261015-9f3c1ab2.webp`. */
  key: string;
  body: Buffer;
  contentType: string;
  cacheControl?: string;
}

export interface PutObjectResult {
  key: string;
  /** Publicly reachable URL for the stored object. */
  url: string;
  driver: StorageDriverName;
}

export interface StorageDriver {
  readonly name: StorageDriverName;
  putObject(input: PutObjectInput): Promise<PutObjectResult>;
}
