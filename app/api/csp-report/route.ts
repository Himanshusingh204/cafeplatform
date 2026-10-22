import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit/limiter";
import { hashIp } from "@/lib/utils/requestId";

// Browsers post violation reports here without credentials, so this route has
// no auth or CSRF requirement. It accepts only small, well-shaped reports and
// is rate limited per client IP.
export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024;
const ALLOWED_TYPES = ["application/csp-report", "application/reports+json", "application/json"];

function clip(value: unknown, max = 200): string | undefined {
  return typeof value === "string" ? value.slice(0, max) : undefined;
}

type Report = Record<string, string | undefined>;

function normalize(body: unknown): Report | null {
  const pick = (r: Record<string, unknown>): Report => ({
    directive: clip(r["effective-directive"] ?? r["effectiveDirective"] ?? r["violated-directive"] ?? r["violatedDirective"], 80),
    blocked: clip(r["blocked-uri"] ?? r["blockedURL"] ?? r["blockedUri"]),
    document: clip(r["document-uri"] ?? r["documentURL"] ?? r["documentUri"]),
    source: clip(r["source-file"] ?? r["sourceFile"]),
    disposition: clip(r["disposition"], 20),
  });

  if (Array.isArray(body)) {
    // Reporting API: [{ type: "csp-violation", body: {...} }]
    const first = body.find(
      (e): e is { type: string; body: Record<string, unknown> } =>
        !!e && typeof e === "object" && (e as { type?: unknown }).type === "csp-violation" &&
        !!(e as { body?: unknown }).body && typeof (e as { body?: unknown }).body === "object"
    );
    return first ? pick(first.body) : null;
  }
  if (body && typeof body === "object") {
    const legacy = (body as { "csp-report"?: unknown })["csp-report"];
    if (legacy && typeof legacy === "object" && !Array.isArray(legacy)) {
      return pick(legacy as Record<string, unknown>);
    }
  }
  return null;
}

export async function POST(request: Request) {
  const type = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!ALLOWED_TYPES.includes(type)) {
    return new NextResponse(null, { status: 415 });
  }

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BYTES) return new NextResponse(null, { status: 413 });

  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip") || "unknown";
  const limit = await rateLimit(`csp-report:${hashIp(ip)}`, 30, 60_000);
  if (!limit.success) return new NextResponse(null, { status: 429 });

  const text = await request.text();
  if (text.length > MAX_BYTES || new TextEncoder().encode(text).length > MAX_BYTES) {
    return new NextResponse(null, { status: 413 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const report = normalize(parsed);
  if (!report) return new NextResponse(null, { status: 400 });

  console.warn(JSON.stringify({ event: "csp.violation", ...report }));
  return new NextResponse(null, { status: 204 });
}
