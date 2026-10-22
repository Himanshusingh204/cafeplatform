import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { renderPrometheus, type Gauge } from "@/lib/observability/metrics";
import { outboxGauges } from "@/lib/observability/readiness";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function safeEqual(a: string, b: string): boolean {
  const l = Buffer.from(a);
  const r = Buffer.from(b);
  return l.length === r.length && timingSafeEqual(l, r);
}

export async function GET(request: Request) {
  const token = process.env.METRICS_TOKEN;
  if (!token) return new NextResponse("Not found", { status: 404 });

  const header = request.headers.get("authorization") ?? "";
  if (!safeEqual(header, `Bearer ${token}`)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  let gauges: Gauge[] = [];
  try {
    gauges = await outboxGauges();
  } catch {
    // Counters must still be served when the database is unavailable.
  }
  return new NextResponse(renderPrometheus(gauges), {
    headers: { "Content-Type": "text/plain; version=0.0.4; charset=utf-8", "Cache-Control": "no-store" },
  });
}
