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

/** Reduce a URL or bare host to a comparable, lower-cased host (incl. port). */
function toHost(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  // Accept both full origins ("https://example.com") and bare hosts
  // ("example.com", "localhost:3000") without letting the URL parser mistake
  // the latter's colon for a scheme delimiter.
  const candidates = trimmed.includes("://") ? [trimmed] : [`https://${trimmed}`];
  for (const candidate of candidates) {
    try {
      const url = new URL(candidate);
      if (url.host) return url.host.toLowerCase();
    } catch {
      // fall through to the next candidate
    }
  }
  return null;
}

function isLocalHost(host: string): boolean {
  return host === "localhost" || host.startsWith("localhost:") ||
    host === "127.0.0.1" || host.startsWith("127.0.0.1:");
}

/**
 * CSRF/second-line-of-defence origin check for browser mutations.
 *
 * Only the canonical `APP_URL` host and an explicit `ALLOWED_ORIGINS` allowlist
 * (comma-separated) are trusted. Preview deployments on shared
 * wildcard-suffix domains (e.g. `*.vercel.app`) are deliberately NOT trusted,
 * because any attacker can host a project on the same suffix. Localhost is
 * trusted only outside production.
 *
 * A missing Origin is allowed: server-to-server and curl clients do not send
 * one, and cookie-backed mutations are still gated by the session itself. Any
 * present-but-untrusted Origin is rejected.
 */
export async function checkOrigin(request: Request): Promise<boolean> {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  const originHost = toHost(origin);
  if (!originHost) return false;

  const trusted = new Set<string>();
  const appHost = toHost(process.env.APP_URL);
  if (appHost) trusted.add(appHost);

  for (const entry of (process.env.ALLOWED_ORIGINS ?? "").split(",")) {
    const host = toHost(entry);
    if (host) trusted.add(host);
  }

  if (trusted.has(originHost)) return true;

  // Local development convenience only; never enabled in production.
  if (process.env.NODE_ENV !== "production" && isLocalHost(originHost)) return true;

  return false;
}
