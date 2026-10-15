import { NextResponse } from "next/server";
import { z } from "zod";
import {
  acquireIdempotency,
  applyRateLimit,
  completeIdempotency,
  hashPayload,
  idempotencyScope,
  readIdempotencyKey,
  releaseIdempotency,
  requiresDistributedBackend,
} from "@/lib/api/request-guards";
import { verifyS2SRequest } from "@/lib/auth/s2s";
import { db } from "@/lib/db/prisma";
import { createOrder, OrderValidationError } from "@/lib/services/orders";
import type { OrderStatus } from "@/lib/generated/prisma/enums";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Per-credential budget for order ingestion: 60 orders per rolling minute. */
const ORDER_RATE_LIMIT_MAX = 60;
const ORDER_RATE_LIMIT_WINDOW_MS = 60_000;

const orderItemSchema = z.object({
  dishId: z.string().uuid().optional(),
  dishName: z.string().min(1).max(200),
  quantity: z.number().int().positive().max(50),
  // Accepted only for ad-hoc items without a dishId. When dishId is present the
  // server always uses the authoritative catalog price and ignores this field.
  price: z.number().positive().optional(),
  station: z.string().max(40).optional(),
  modifiers: z
    .array(
      z.object({
        groupName: z.string().min(1).max(80),
        optionName: z.string().min(1).max(80),
        priceDelta: z.number().nonnegative(),
      })
    )
    .optional(),
});

const createOrderSchema = z.object({
  customerName: z.string().min(2).max(100),
  customerEmail: z.string().email(),
  customerPhone: z.string().min(8).max(20),
  pickupTime: z.string().max(80).optional(),
  diningMode: z.enum(["DINE_IN", "TAKEAWAY", "DELIVERY"]).optional(),
  tableNumber: z.string().max(20).optional(),
  tip: z.number().nonnegative().max(100000).optional(),
  specialInstructions: z.string().max(500).optional(),
  items: z.array(orderItemSchema).min(1, "At least one item is required"),
  couponCode: z.string().max(40).optional(),
  loyaltyPointsToRedeem: z.number().int().nonnegative().optional(),
  paymentMethod: z.enum(["PAY_AT_PICKUP", "CARD_ONLINE"]).optional(),
  paymentStatus: z.enum(["PENDING", "PAID", "PAY_AT_PICKUP"]).optional(),
});

/**
 * GET /api/v1/orders
 * Retrieve tenant orders with optional status filtering.
 */
export async function GET(request: Request) {
  const auth = await verifyS2SRequest(request, "orders:read");
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const limit = Math.min(Number(searchParams.get("limit") || 50), 100);

  const tenantId = auth.context.tenantId;

  const orders = await db.order.findMany({
    where: {
      OR: [{ tenantId }, { tenantId: null }],
      ...(status ? { orderStatus: status as OrderStatus } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      items: true,
    },
  });

  return NextResponse.json({
    tenantId,
    count: orders.length,
    orders,
  });
}

/**
 * POST /api/v1/orders
 * B2B S2S order ingestion (e.g. from POS hardware, delivery aggregators, kiosk).
 *
 * All pricing, coupon, loyalty, inventory and station routing is delegated to
 * the shared `createOrder` service so this adapter holds no business logic and
 * cannot diverge from the Express adapter or the customer checkout flow.
 * Client-supplied prices are never trusted for catalog dishes.
 *
 * Request guards run in a fixed order, cheapest and most decisive first:
 * authenticate → fail closed without a shared backend → parse → validate →
 * rate limit → deduplicate. The route is retry-safe for any caller that sends
 * an `Idempotency-Key`; without one it behaves exactly as before.
 */
export async function POST(request: Request) {
  const auth = await verifyS2SRequest(request, "orders:write");
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // Duplicate order acceptance is a money bug. In production we refuse to serve
  // the money path on per-instance memory, which cannot dedupe across instances.
  if (requiresDistributedBackend()) {
    return NextResponse.json(
      { error: "Order ingestion is unavailable: shared rate-limit and idempotency storage is not configured." },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const parsed = createOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  const limit = await applyRateLimit(
    `orders:create:${auth.context.id}`,
    ORDER_RATE_LIMIT_MAX,
    ORDER_RATE_LIMIT_WINDOW_MS
  );
  if (!limit.success) {
    return NextResponse.json(
      { error: "Too many order requests. Please retry shortly." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(1, Math.ceil(limit.retryAfterMs / 1000))),
        },
      }
    );
  }

  // The key names one operation for one tenant on this endpoint. The payload
  // fingerprint is recorded alongside it so a key replayed with a *different*
  // body is rejected rather than answered with an unrelated order.
  const idempotencyKey = readIdempotencyKey(request);
  const payloadHash = hashPayload(parsed.data);
  const scope = idempotencyKey
    ? idempotencyScope(auth.context.tenantId, "orders.create", idempotencyKey)
    : null;

  if (scope) {
    const acquisition = await acquireIdempotency(scope, payloadHash);

    if (acquisition.status === "replay") {
      return NextResponse.json(acquisition.response.body, {
        status: acquisition.response.statusCode,
        headers: { "Idempotent-Replay": "true" },
      });
    }

    if (acquisition.status === "in_flight") {
      return NextResponse.json(
        { error: "A request with this Idempotency-Key is already in flight." },
        { status: 409, headers: { "Retry-After": "1" } }
      );
    }

    if (acquisition.status === "conflict") {
      return NextResponse.json(
        {
          error:
            "This Idempotency-Key was already used for a different request body. Use a new key for a new order.",
        },
        { status: 409 }
      );
    }
  }

  try {
    const order = await createOrder({
      ...parsed.data,
      tenantId: auth.context.tenantId,
    });

    const responseBody = { message: "Order successfully ingested", order };
    if (scope) {
      await completeIdempotency(scope, 201, responseBody, payloadHash);
    }

    return NextResponse.json(responseBody, { status: 201 });
  } catch (error) {
    // Free the key so a genuine retry after a transient failure is not blocked
    // until the record expires.
    if (scope) {
      await releaseIdempotency(scope);
    }

    if (error instanceof OrderValidationError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    console.error("Order ingestion failed:", error);
    return NextResponse.json({ error: "Unable to create order" }, { status: 500 });
  }
}
