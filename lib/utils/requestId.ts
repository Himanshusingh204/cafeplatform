import { createHash, randomBytes } from "node:crypto";

export function createRequestId(): string {
  return randomBytes(8).toString("hex");
}

export function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex").slice(0, 40);
}