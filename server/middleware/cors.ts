import type { CorsOptions } from "cors";

/** Reduce a configured URL to its bare origin; unusable values yield null. */
export function normalizeOrigin(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === "*") return null;
  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
}

/**
 * Explicit CORS allow-list from env: APP_URL, CLIENT_URL and the comma-separated
 * ALLOWED_ORIGINS. A wildcard is never honoured (credentials are enabled), and
 * localhost is added outside production only.
 */
export function buildAllowedOrigins(env: NodeJS.ProcessEnv = process.env): Set<string> {
  const out = new Set<string>();
  const configured = [env.APP_URL, env.CLIENT_URL, ...(env.ALLOWED_ORIGINS ?? "").split(",")];
  for (const value of configured) {
    const origin = normalizeOrigin(value);
    if (origin) out.add(origin);
  }
  if (env.NODE_ENV !== "production") {
    out.add("http://localhost:3000");
    out.add("http://127.0.0.1:3000");
  }
  return out;
}

export function buildCorsOptions(
  allowed: Set<string>,
  onReject?: (origin: string) => void
): CorsOptions {
  return {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // no Origin: not a browser CORS request
      if (allowed.has(origin)) return callback(null, true);
      onReject?.(origin);
      callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-api-key", "x-razorpay-signature", "Idempotency-Key"],
  };
}
