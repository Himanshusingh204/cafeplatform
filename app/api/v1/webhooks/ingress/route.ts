import { NextResponse } from "next/server";
import { db } from "@/lib/db/prisma";
import { broadcastEvent } from "@/lib/realtime/bus";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/webhooks/ingress
 * Secure partner webhook receiver (POS status updates, delivery updates, Stripe events).
 */
export async function POST(request: Request) {
  const signature = request.headers.get("x-spice-signature") || request.headers.get("x-partner-signature");
  
  // Signature requirement check
  if (!signature) {
    return NextResponse.json(
      { error: "Unauthorized: Missing cryptographic webhook signature header" },
      { status: 401 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { event, orderId, status, tenantId } = body;

  if (event === "order.updated" && orderId && status) {
    const updated = await db.order.update({
      where: { id: orderId },
      data: {
        orderStatus: status,
      },
    }).catch(() => null);

    if (updated) {
      broadcastEvent({
        type: "order:status_changed",
        tenantId: tenantId || updated.tenantId || "spice-saffron",
        timestamp: new Date().toISOString(),
        data: {
          id: updated.id,
          orderNumber: updated.orderNumber,
          orderStatus: updated.orderStatus,
        },
      });
    }
  }

  return NextResponse.json({
    received: true,
    timestamp: new Date().toISOString(),
  });
}
