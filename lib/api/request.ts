import "server-only";

import { headers } from "next/headers";
import { hashIp } from "@/lib/utils/requestId";

export async function getClientIp(): Promise<string | null> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return h.get("x-real-ip") ?? null;
}

export async function getIpHash(): Promise<string | null> {
  const ip = await getClientIp();
  return ip ? hashIp(ip) : null;
}

export async function checkOrigin(request: Request): Promise<boolean> {
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const origin = request.headers.get("origin");
  if (!origin) return true; // non-browser client; sessions still gate mutations
  try {
    const host = new URL(origin).host;
    const appHost = new URL(appUrl).host;
    return host === appHost || host.endsWith(".vercel.app");
  } catch {
    return false;
  }
}