import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * Public origin that uploaded objects are served from (S3 / R2 / MinIO).
 * Read at build time so `next/image` may optimise remote uploads and so the
 * Content-Security-Policy permits them. Absent in dev, where uploads are local.
 */
function resolveStorageOrigin(): URL | null {
  const raw = process.env.STORAGE_PUBLIC_URL?.trim();
  if (!raw) return null;
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

const storageOrigin = resolveStorageOrigin();
const storageCspSource = storageOrigin ? ` ${storageOrigin.origin}` : "";

// Self-hosted fonts/images only, so 'self' covers everything legitimate.
// Inline scripts/styles are required by Next.js bootstrap; eval only in dev.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://checkout.razorpay.com https://js.stripe.com${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' blob: data: https://*.razorpay.com https://*.stripe.com${storageCspSource}`,
  "font-src 'self'",
  `connect-src 'self' https://api.razorpay.com https://lumberjack.razorpay.com https://api.stripe.com${storageCspSource}`,
  "frame-src 'self' https://api.razorpay.com https://js.stripe.com https://www.google.com https://maps.google.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

// Trial policy, report-only: same hosts as above but no inline or eval script
// execution. Next.js inlines scripts, so this reports on every page view; it is
// opt-in (CSP_REPORT_ONLY=true) while a nonce-based policy is being worked out. Violations are posted to /api/csp-report. See docs/OPERATIONS.md.
const reportOnlyPolicy = contentSecurityPolicy
  .replace(/script-src [^;]*/, "script-src 'self' https://checkout.razorpay.com https://js.stripe.com")
  .concat("; report-uri /api/csp-report");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  ...(process.env.CSP_REPORT_ONLY === "true"
    ? [{ key: "Content-Security-Policy-Report-Only", value: reportOnlyPolicy }]
    : []),
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=*",
  },
  // Ignored over plain HTTP locally; enforced once deployed behind HTTPS.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    ...(storageOrigin
      ? {
          remotePatterns: [
            {
              protocol: storageOrigin.protocol.replace(":", "") as "http" | "https",
              hostname: storageOrigin.hostname,
              pathname: "/**",
            },
          ],
        }
      : {}),
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
