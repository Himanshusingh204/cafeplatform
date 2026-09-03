import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyS2SRequest } from "@/lib/auth/s2s";
import { db } from "@/lib/db/prisma";
import { broadcastEvent } from "@/lib/realtime/bus";
import { dispatchWebhook } from "@/lib/webhooks/dispatcher";

export const dynamic = "force-dynamic";

const patchOrderSchema = z.object({
  orderStatus: z.enum(["PENDING", "CONFIRMED", "PREPARING", "READY", "COMPLETED", "CANCELLED"]).optional(),
  paymentStatus: z.enum(["PENDING", "PAID", "PAY_AT_PICKUP"]).optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/orders/:id
 * Retrieve single order by ID or order number.
 */
export async function GET(request: Request, { params }: RouteParams) {
  const auth = await verifyS2SRequest(request, "orders:read");
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const tenantId = auth.context.tenantId;

  const order = await db.order.findFirst({
    where: {
      OR: [{ id }, { orderNumber: id }],
      AND: [{ OR: [{ tenantId }, { tenantId: null }] }],
    },
    include: {
      items: true,
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  return NextResponse.json({ order });
}

/**
 * PATCH /api/v1/orders/:id
 * Update order status or payment status.
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const auth = await verifyS2SRequest(request, "orders:write");
  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const tenantId = auth.context.tenantId;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const parsed = patchOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  const order = await db.order.findFirst({
    where: {
      OR: [{ id }, { orderNumber: id }],
      AND: [{ OR: [{ tenantId }, { tenantId: null }] }],
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const updated = await db.order.update({
    where: { id: order.id },
    data: {
      ...(parsed.data.orderStatus ? { orderStatus: parsed.data.orderStatus } : {}),
      ...(parsed.data.paymentStatus ? { paymentStatus: parsed.data.paymentStatus } : {}),
    },
    include: {
      items: true,
    },
  });

  // Broadcast to Real-Time KDS
  broadcastEvent({
    type: "order:status_changed",
    tenantId,
    timestamp: new Date().toISOString(),
    data: {
      id: updated.id,
      orderNumber: updated.orderNumber,
      orderStatus: updated.orderStatus,
      paymentStatus: updated.paymentStatus,
    },
  });

  // Dispatch outbound webhook
  dispatchWebhook({
    event: "order.status_changed",
    tenantId,
    data: {
      id: updated.id,
      orderNumber: updated.orderNumber,
      orderStatus: updated.orderStatus,
      paymentStatus: updated.paymentStatus,
    },
  }).catch(() => {});

  return NextResponse.json({
    message: "Order updated successfully",
    order: updated,
  });
}
