"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db/prisma";
import {
  createPaymentOrder,
  verifyRazorpaySignature,
  type PaymentOrderResult,
} from "@/lib/payments/engine";
import { broadcastEvent } from "@/lib/realtime/bus";
import { logger } from "@/lib/logger";

export interface PaymentActionResult<T = unknown> {
  ok: boolean;
  error?: string;
  data?: T;
}

/**
 * The storefront checkout is anonymous, so there is no customer session to bind
 * an order to. The compensating access model is:
 *  - the order must exist and still be payable (not PAID, not cancelled/completed);
 *  - it must be recent, i.e. created within the short window in which the
 *    checkout page can still be open.
 *
 * Residual risk (accepted for now): there is no signed, order-scoped token, so
 * an attacker who learns a fresh unpaid order id can ask us to create a gateway
 * order for it (a nuisance/possible DB write), but cannot mark it PAID without a
 * valid gateway HMAC signature, and cannot touch old or settled orders. Adding a
 * signed order token minted by `submitTakeawayOrderAction` would close this.
 */
const ORDER_PAYMENT_WINDOW_MS = 2 * 60 * 60 * 1000;

/** Returns an error message when an order is no longer payable, else null. */
function payableOrderError(order: {
  paymentStatus: string;
  orderStatus: string;
  createdAt: Date;
}): string | null {
  if (order.paymentStatus === "PAID") return "Order is already paid.";
  if (order.orderStatus === "CANCELLED") return "Order has been cancelled.";
  if (order.orderStatus === "COMPLETED") return "Order is already complete.";
  if (Date.now() - order.createdAt.getTime() > ORDER_PAYMENT_WINDOW_MS) {
    return "The payment window for this order has expired.";
  }
  return null;
}

/**
 * Initializes a payment order with Razorpay/Stripe and updates the order with the gateway ID.
 */
export async function initiateOrderPaymentAction(
  orderId: string
): Promise<PaymentActionResult<PaymentOrderResult>> {
  try {
    const order = await db.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return { ok: false, error: "Order not found." };
    }

    const payableError = payableOrderError(order);
    if (payableError) {
      return { ok: false, error: payableError };
    }

    const paymentResult = await createPaymentOrder({
      orderId: order.id,
      orderNumber: order.orderNumber,
      amount: Number(order.total),
      currency: "INR",
    });

    // Save gateway order ID on the order record
    await db.order.update({
      where: { id: order.id },
      data: {
        gatewayOrderId: paymentResult.gatewayOrderId,
        paymentMethod: paymentResult.provider,
      },
    });

    return { ok: true, data: paymentResult };
  } catch (error) {
    logger.error({ event: "payment.initiate_error", error: String(error) });
    return { ok: false, error: "Failed to initiate payment. Please try again." };
  }
}

/**
 * Confirms payment signature received from client-side modal checkout.
 */
export async function verifyClientPaymentAction(input: {
  orderId: string;
  paymentId: string;
  signature: string;
}): Promise<PaymentActionResult<{ orderId: string }>> {
  try {
    const order = await db.order.findUnique({
      where: { id: input.orderId },
      include: { items: true },
    });

    if (!order) {
      return { ok: false, error: "Order not found." };
    }

    // Idempotent: return success if already marked as paid
    if (order.paymentStatus === "PAID") {
      return { ok: true, data: { orderId: order.id } };
    }

    // A cancelled order must never be confirmed as paid, even with a valid
    // signature (it would resurrect a refunded/cancelled sale).
    if (order.orderStatus === "CANCELLED") {
      return { ok: false, error: "Order has been cancelled." };
    }

    // Security Guard: An order cannot be verified as paid online without an active gateway order ID
    if (!order.gatewayOrderId) {
      return {
        ok: false,
        error: "Payment verification failed: No active online payment session found for this order.",
      };
    }

    // Verify cryptographic HMAC signature
    const isValid = verifyRazorpaySignature({
      orderId: order.gatewayOrderId,
      paymentId: input.paymentId,
      signature: input.signature,
    });

    if (!isValid) {
      return { ok: false, error: "Payment verification failed: Invalid signature." };
    }

    const updatedOrder = await db.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: "PAID",
        orderStatus: "CONFIRMED",
        gatewayPaymentId: input.paymentId,
        gatewaySignature: input.signature,
      },
      include: { items: true },
    });

    // Real-time KDS dispatch
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

    revalidatePath(`/order/${updatedOrder.id}`);
    revalidatePath("/admin/orders");
    revalidatePath("/admin/kds");

    return { ok: true, data: { orderId: updatedOrder.id } };
  } catch (error) {
    logger.error({ event: "payment.verify_error", error: String(error) });
    return { ok: false, error: "Failed to confirm payment status." };
  }
}
