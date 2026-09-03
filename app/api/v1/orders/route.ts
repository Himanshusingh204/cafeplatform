import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyS2SRequest } from "@/lib/auth/s2s";
import { db } from "@/lib/db/prisma";
import { broadcastEvent } from "@/lib/realtime/bus";
import { dispatchWebhook } from "@/lib/webhooks/dispatcher";
import type { OrderStatus } from "@/lib/generated/prisma/enums";

export const dynamic = "force-dynamic";

const createOrderSchema = z.object({
  customerName: z.string().min(2).max(100),
  customerEmail: z.string().email(),
  customerPhone: z.string().min(8).max(20),
  pickupTime: z.string().min(1),
  specialInstructions: z.string().max(500).optional(),
  items: z.array(
    z.object({
      dishId: z.string().uuid().optional(),
      dishName: z.string().min(1),
      quantity: z.number().int().positive().max(50),
      price: z.number().positive(),
    })
  ).min(1, "At least one item is required"),
  paymentStatus: z.enum(["PENDING", "PAID", "PAY_AT_PICKUP"]).default("PENDING"),
  couponCode: z.string().optional(),
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
 */
export async function POST(request: Request) {
  const auth = await verifyS2SRequest(request, "orders:write");
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body;
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

  const data = parsed.data;
  const tenantId = auth.context.tenantId;

  // Calculate pricing
  const subtotal = data.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const tax = Math.round(subtotal * 0.05 * 100) / 100; // 5% GST
  const discount = 0;
  const total = subtotal + tax - discount;

  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const orderNumber = `ORD-${Date.now().toString().slice(-6)}-${randomSuffix}`;

  const order = await db.order.create({
    data: {
      tenantId,
      orderNumber,
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      customerPhone: data.customerPhone,
      pickupTime: data.pickupTime,
      specialInstructions: data.specialInstructions,
      subtotal,
      tax,
      discount,
      total,
      paymentStatus: data.paymentStatus,
      orderStatus: "PENDING",
      couponCode: data.couponCode,
      items: {
        create: data.items.map((i) => ({
          dishId: i.dishId,
          dishName: i.dishName,
          quantity: i.quantity,
          price: i.price,
        })),
      },
    },
    include: {
      items: true,
    },
  });

  // Broadcast to Real-Time Kitchen Display System (KDS)
  broadcastEvent({
    type: "order:created",
    tenantId,
    timestamp: new Date().toISOString(),
    data: {
      id: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      total: Number(order.total),
      pickupTime: order.pickupTime,
      items: order.items,
    },
  });

  // Dispatch outbound webhook to partner endpoints
  dispatchWebhook({
    event: "order.created",
    tenantId,
    data: {
      id: order.id,
      orderNumber: order.orderNumber,
      total: Number(order.total),
      customerName: order.customerName,
      pickupTime: order.pickupTime,
    },
  }).catch(() => {});

  return NextResponse.json(
    {
      message: "Order successfully ingested",
      order,
    },
    { status: 201 }
  );
}
