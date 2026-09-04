import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/prisma";
import { verifyRazorpayWebhookSignature } from "@/lib/payments/engine";
import { broadcastEvent } from "@/lib/realtime/bus";
import { sendOrderReceipt } from "@/lib/email/notifier";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/webhooks/payment
 * Cryptographically verified, idempotent payment webhook processor.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature");

  // 1. Verify cryptographic signature if in production
  if (process.env.NODE_ENV === "production" || process.env.RAZORPAY_WEBHOOK_SECRET) {
    if (!signature) {
      return NextResponse.json({ error: "Missing signature header" }, { status: 400 });
    }

    const isValid = verifyRazorpayWebhookSignature(rawBody, signature);
    if (!isValid) {
      logger.error({ event: "webhook.payment.invalid_signature" });
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }
  }

  let eventPayload: Record<string, unknown>;
  try {
    eventPayload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Malformed JSON payload" }, { status: 400 });
  }

  const eventType = String(eventPayload.event || "");
  const payloadData = (eventPayload.payload as Record<string, unknown>) || {};
  const paymentObj = (
    (payloadData.payment as Record<string, unknown>)?.entity as Record<string, unknown>
  ) || {};

  const paymentId = String(paymentObj.id || "");
  const gatewayOrderId = String(paymentObj.order_id || "");
  const notes = (paymentObj.notes as Record<string, string>) || {};
  const appOrderId = notes.appOrderId;

  logger.info({
    event: "webhook.payment.received",
    type: eventType,
    paymentId,
    gatewayOrderId,
    appOrderId,
  });

  // Handle successful capture events
  if (eventType === "payment.captured" || eventType === "order.paid") {
    try {
      // Find matching order
      const order = await db.order.findFirst({
        where: {
          OR: [
            appOrderId ? { id: appOrderId } : { gatewayOrderId },
            { gatewayOrderId: gatewayOrderId || undefined },
          ],
        },
        include: { items: true },
      });

      if (!order) {
        logger.warn({ event: "webhook.payment.order_not_found", gatewayOrderId, appOrderId });
        return NextResponse.json({ received: true, note: "Order not found" }, { status: 200 });
      }

      // 2. Idempotency Check: Already processed?
      if (order.paymentStatus === "PAID") {
        logger.info({ event: "webhook.payment.already_paid", orderId: order.id });
        return NextResponse.json({ received: true, note: "Already processed" }, { status: 200 });
      }

      // 3. Update Order atomically
      const updatedOrder = await db.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: "PAID",
          orderStatus: "CONFIRMED",
          gatewayPaymentId: paymentId || order.gatewayPaymentId,
          gatewaySignature: signature || order.gatewaySignature,
          paymentMethod: "RAZORPAY",
        },
        include: { items: true },
      });

      // 4. Notify KDS in real-time
      broadcastEvent({
        type: "order:status_changed",
        tenantId: updatedOrder.tenantId || "spice-saffron",
        timestamp: new Date().toISOString(),
        data: {
          id: updatedOrder.id,
          orderNumber: updatedOrder.orderNumber,
          orderStatus: "CONFIRMED",
          paymentStatus: "PAID",
        },
      });

      // 5. Send customer receipt
      sendOrderReceipt({
        customerName: updatedOrder.customerName,
        customerEmail: updatedOrder.customerEmail,
        orderNumber: updatedOrder.orderNumber,
        pickupTime: updatedOrder.pickupTime,
        total: Number(updatedOrder.total),
        items: updatedOrder.items.map((i) => ({
          dishName: i.dishName,
          quantity: i.quantity,
          price: Number(i.price),
        })),
      }).catch(() => undefined);

      return NextResponse.json({ received: true, success: true, orderId: updatedOrder.id });
    } catch (dbError) {
      logger.error({ event: "webhook.payment.db_error", error: String(dbError) });
      return NextResponse.json({ error: "Database processing failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true, ignored: true });
}
