import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { processOutbox } from "@/lib/outbox/process";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  // Compare equal-length digests of the lengths too, without early exit on content.
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
    }
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const header = request.headers.get("authorization") ?? "";
  if (!safeEqual(header, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const result = await processOutbox(25);
  return NextResponse.json(result);
}
