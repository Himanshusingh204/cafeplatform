import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyS2SRequest } from "@/lib/auth/s2s";
import { db } from "@/lib/db/prisma";
import { createOrder, OrderValidationError } from "@/lib/services/orders";
import type { OrderStatus } from "@/lib/generated/prisma/enums";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
 */
export async function POST(request: Request) {
  const auth = await verifyS2SRequest(request, "orders:write");
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
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

  try {
    const order = await createOrder({
      ...parsed.data,
      tenantId: auth.context.tenantId,
    });

    return NextResponse.json(
      { message: "Order successfully ingested", order },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof OrderValidationError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    console.error("Order ingestion failed:", error);
    return NextResponse.json({ error: "Unable to create order" }, { status: 500 });
  }
}
