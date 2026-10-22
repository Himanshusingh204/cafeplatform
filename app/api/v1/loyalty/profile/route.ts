import { apiError } from "@/lib/api/errors";
import { NextResponse } from "next/server";
import { z } from "zod";
import { applyRateLimit, clientFingerprint } from "@/lib/api/request-guards";
import { db } from "@/lib/db/prisma";
import { getCustomerLoyaltyProfile } from "@/lib/services/loyalty";

export const dynamic = "force-dynamic";

const LOOKUP_RATE_LIMIT_MAX = 10;
const LOOKUP_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

const lookupQuerySchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  orderNumber: z.string().trim().min(1).max(40),
});

const NOT_FOUND_MESSAGE = "No loyalty profile found for those details";

/**
 * Public loyalty lookup gated by proof of purchase.
 *
 * A profile is only disclosed when the caller supplies both the email and an
 * order number belonging to that email, so knowing an address is not enough to
 * read someone else's PII or loyalty history. This route never creates rows.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = lookupQuerySchema.safeParse({
      email: searchParams.get("email") ?? undefined,
      orderNumber: searchParams.get("orderNumber") ?? undefined,
    });

    const limit = await applyRateLimit(
      `loyalty:lookup:${clientFingerprint(request)}`,
      LOOKUP_RATE_LIMIT_MAX,
      LOOKUP_RATE_LIMIT_WINDOW_MS
    );
    if (!limit.success) {
      return apiError(429, "Too many lookup attempts. Please retry later.", "rate_limited", {
        request,
        headers: {
          ...NO_STORE_HEADERS,
          "Retry-After": String(Math.max(1, Math.ceil(limit.retryAfterMs / 1000))),
        },
      });
    }

    if (!query.success) {
      return apiError(400, "Email and orderNumber query params are required", "invalid_request", {
        request,
        headers: NO_STORE_HEADERS,
      });
    }

    const { email, orderNumber } = query.data;

    // Proof of purchase: the order number must belong to the supplied email.
    // A missing customer record and a mismatched order answer identically so the
    // endpoint cannot be used to enumerate which email addresses are customers.
    const order = await db.order.findFirst({
      where: {
        orderNumber,
        customerEmail: { equals: email, mode: "insensitive" },
      },
      select: { id: true },
    });

    if (!order) {
      return apiError(404, NOT_FOUND_MESSAGE, "not_found", { request, headers: NO_STORE_HEADERS });
    }

    const profile = await getCustomerLoyaltyProfile(email);
    if (!profile) {
      return apiError(404, NOT_FOUND_MESSAGE, "not_found", { request, headers: NO_STORE_HEADERS });
    }

    return NextResponse.json(profile, { headers: NO_STORE_HEADERS });
  } catch (error) {
    console.error("Loyalty profile lookup error:", error instanceof Error ? error.name : "unknown");
    return apiError(500, "Internal server error", "internal_error", { request, headers: NO_STORE_HEADERS });
  }
}
