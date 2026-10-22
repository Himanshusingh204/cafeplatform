import { apiError } from "@/lib/api/errors";
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
import { createOrderSchema } from "@/lib/api/order-schema";
import { createOrder, OrderValidationError } from "@/lib/services/orders";
import { PlanLimitError } from "@/lib/plans";
import { recordOrderCreated, recordOrderFailed } from "@/lib/observability/metrics";
import { OrderStatus } from "@/lib/generated/prisma/enums";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Per-credential budget for order ingestion: 60 orders per rolling minute. */
const ORDER_RATE_LIMIT_MAX = 60;
const ORDER_RATE_LIMIT_WINDOW_MS = 60_000;
const ORDERS_LIST_DEFAULT_LIMIT = 50;
const ORDERS_LIST_MAX_LIMIT = 100;

const orderStatusSchema = z.enum(
  Object.values(OrderStatus) as [OrderStatus, ...OrderStatus[]]
);

/**
 * GET /api/v1/orders
 * Retrieve tenant orders with optional status filtering.
 */
export async function GET(request: Request) {
  const auth = await verifyS2SRequest(request, "orders:read");
  if (!auth.success) {
    return apiError(auth.status, auth.error);
  }

  const { searchParams } = new URL(request.url);

  // Reject malformed filters with a 400 instead of letting Prisma throw a 500
  // (invalid enums) or silently return an unbounded/empty page (NaN take).
  const rawStatus = searchParams.get("status");
  const parsedStatus = rawStatus === null || rawStatus === ""
    ? { success: true as const, data: undefined }
    : orderStatusSchema.safeParse(rawStatus);
  if (!parsedStatus.success) {
    return apiError(400, "Invalid status filter", undefined, { allowed: Object.values(OrderStatus) });
  }
  const status = parsedStatus.data;

  const rawLimit = searchParams.get("limit");
  const requestedLimit =
    rawLimit === null || rawLimit.trim() === ""
      ? ORDERS_LIST_DEFAULT_LIMIT
      : Number(rawLimit);
  if (!Number.isFinite(requestedLimit)) {
    return apiError(400, `Invalid limit. Expected an integer between 1 and ${ORDERS_LIST_MAX_LIMIT}.`);
  }
  const limit = Math.min(
    ORDERS_LIST_MAX_LIMIT,
    Math.max(1, Math.trunc(requestedLimit))
  );

  const tenantId = auth.context.tenantId;

  const orders = await db.order.findMany({
    where: {
      // Strict tenant equality: legacy rows with a null tenantId are never
      // readable through a tenant-scoped API key.
      tenantId,
      ...(status ? { orderStatus: status } : {}),
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
    return apiError(auth.status, auth.error);
  }

  // Duplicate order acceptance is a money bug. In production we refuse to serve
  // the money path on per-instance memory, which cannot dedupe across instances.
  if (requiresDistributedBackend()) {
    return apiError(503, "Order ingestion is unavailable: shared rate-limit and idempotency storage is not configured.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "Invalid JSON payload");
  }

  const parsed = createOrderSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(422, "Validation failed", undefined, { details: parsed.error.flatten().fieldErrors });
  }

  const limit = await applyRateLimit(
    `orders:create:${auth.context.id}`,
    ORDER_RATE_LIMIT_MAX,
    ORDER_RATE_LIMIT_WINDOW_MS
  );
  if (!limit.success) {
    return apiError(429, "Too many order requests. Please retry shortly.", "rate_limited", {
      request,
      headers: {
        "Retry-After": String(Math.max(1, Math.ceil(limit.retryAfterMs / 1000))),
      },
    });
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
      return apiError(409, "A request with this Idempotency-Key is already in flight.", "conflict", {
        request,
        headers: { "Retry-After": "1" },
      });
    }

    if (acquisition.status === "conflict") {
      return apiError(409, "This Idempotency-Key was already used for a different request body. Use a new key for a new order.");
    }
  }

  try {
    const order = await createOrder({
      ...parsed.data,
      tenantId: auth.context.tenantId,
      // This route is S2S-authenticated, so a POS may legitimately sell a
      // custom line that is not in the catalog. The public storefront never can.
      allowAdHoc: true,
    });

    recordOrderCreated();
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
      recordOrderFailed();
      return apiError(422, error.message);
    }
    if (error instanceof PlanLimitError) {
      recordOrderFailed();
      return apiError(402, error.message);
    }
    recordOrderFailed();
    console.error("Order ingestion failed:", error);
    return apiError(500, "Unable to create order");
  }
}
