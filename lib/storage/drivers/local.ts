import "server-only";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { PutObjectInput, PutObjectResult, StorageDriver } from "../types";

const PUBLIC_UPLOAD_DIR = path.join("public", "uploads");

/**
 * Development / self-host driver. Writes into `public/uploads`, which Next.js
 * serves statically and which is git-ignored.
 *
 * This driver CANNOT work on a read-only serverless filesystem — that is
 * intentional. In production an object-store driver must be configured.
 */
export function createLocalDriver(): StorageDriver {
  const baseDir = path.join(process.cwd(), PUBLIC_UPLOAD_DIR);

  return {
    name: "local",
    async putObject({ key, body }: PutObjectInput): Promise<PutObjectResult> {
      const target = path.resolve(baseDir, key);
      if (target !== baseDir && !target.startsWith(baseDir + path.sep)) {
        throw new Error(`Refusing to write outside the upload directory: ${key}`);
      }

      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, body);

      return { key, url: `/uploads/${key}`, driver: "local" };
    },
  };
}
