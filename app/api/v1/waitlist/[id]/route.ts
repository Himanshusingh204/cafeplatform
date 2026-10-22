import { apiError } from "@/lib/api/errors";
import { NextResponse } from "next/server";
import { z } from "zod";
import { applyRateLimit, clientFingerprint } from "@/lib/api/request-guards";
import { getPublicWaitlistPosition } from "@/lib/services/waitlist";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const limit = await applyRateLimit(`waitlist:lookup:${clientFingerprint(_request)}`, 60, 60_000);
    if (!limit.success) {
      return apiError(429, "Too many requests");
    }

    const parsedId = z.string().uuid().safeParse((await params).id);
    if (!parsedId.success) {
      return apiError(404, "Waitlist entry not found");
    }
    const id = parsedId.data;
    const position = await getPublicWaitlistPosition(id);

    if (!position) {
      return apiError(404, "Waitlist entry not found");
    }

    return NextResponse.json(position);
  } catch (error) {
    console.error("Waitlist public lookup error:", error instanceof Error ? error.name : "unknown");
    return apiError(500, "Internal server error");
  }
}
