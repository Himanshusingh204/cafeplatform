import { NextResponse } from "next/server";
import { checkReadiness } from "@/lib/observability/readiness";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Readiness: 503 only when Postgres is down; Redis/outbox problems report "degraded". */
export async function GET() {
  const { httpStatus, body } = await checkReadiness();
  return NextResponse.json(body, { status: httpStatus, headers: { "Cache-Control": "no-store" } });
}
