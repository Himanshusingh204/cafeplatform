import { apiError } from "@/lib/api/errors";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/prisma";
import { verifyRazorpayWebhookSignature } from "@/lib/payments/engine";
import { broadcastEvent } from "@/lib/realtime/bus";
import { logger } from "@/lib/logger";
import { captureRejection } from "@/lib/payments/capture-guard";

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
      return apiError(400, "Missing signature header");
    }

    const isValid = verifyRazorpayWebhookSignature(rawBody, signature);
    if (!isValid) {
      logger.error({ event: "webhook.payment.invalid_signature" });
      return apiError(400, "Invalid signature");
    }
  }

  let eventPayload: Record<string, unknown>;
  try {
    eventPayload = JSON.parse(rawBody);
  } catch {
    return apiError(400, "Malformed JSON payload");
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
      if (!appOrderId && !gatewayOrderId) {
        logger.warn({ event: "webhook.payment.missing_identifiers", eventType });
        return NextResponse.json({ received: true, note: "No order identifiers found in payload" }, { status: 200 });
      }

      // Find matching order
      const order = await db.order.findFirst({
        where: {
          OR: [
            ...(appOrderId ? [{ id: appOrderId }] : []),
            ...(gatewayOrderId ? [{ gatewayOrderId }] : []),
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

      const rejection = captureRejection(order, paymentObj.amount);
      if (rejection) {
        logger.error({
          event: "webhook.payment.rejected",
          orderId: order.id,
          paymentId,
          amount: paymentObj.amount,
          reason: rejection,
        });
        return NextResponse.json({ received: true, note: rejection }, { status: 200 });
      }

      // 3. Claim the order atomically: a concurrent duplicate delivery matches 0 rows.
      const claimed = await db.order.updateMany({
        where: { id: order.id, paymentStatus: { not: "PAID" } },
        data: {
          paymentStatus: "PAID",
          orderStatus: "CONFIRMED",
          gatewayPaymentId: paymentId || order.gatewayPaymentId,
          gatewaySignature: signature || order.gatewaySignature,
          paymentMethod: "RAZORPAY",
        },
      });
      if (claimed.count === 0) {
        return NextResponse.json({ received: true, note: "Already processed" }, { status: 200 });
      }
      const updatedOrder = await db.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { items: true },
      });

      // 4. Notify KDS in real-time
      broadcastEvent({
        type: "order:status_changed",
        tenantId: updatedOrder.tenantId,
        timestamp: new Date().toISOString(),
        data: {
          id: updatedOrder.id,
          orderNumber: updatedOrder.orderNumber,
          orderStatus: "CONFIRMED",
          paymentStatus: "PAID",
        },
      });

      return NextResponse.json({ received: true, success: true, orderId: updatedOrder.id });
    } catch (dbError) {
      logger.error({ event: "webhook.payment.db_error", error: String(dbError) });
      return apiError(500, "Database processing failed");
    }
  }

  return NextResponse.json({ received: true, ignored: true });
}
