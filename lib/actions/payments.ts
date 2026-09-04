"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db/prisma";
import {
  createPaymentOrder,
  verifyRazorpaySignature,
  type PaymentOrderResult,
} from "@/lib/payments/engine";
import { broadcastEvent } from "@/lib/realtime/bus";
import { sendOrderReceipt } from "@/lib/email/notifier";
import { logger } from "@/lib/logger";

export interface PaymentActionResult<T = unknown> {
  ok: boolean;
  error?: string;
  data?: T;
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

    if (order.paymentStatus === "PAID") {
      return { ok: false, error: "Order is already paid." };
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

    // Verify cryptographic signature if razorpay order ID is present
    if (order.gatewayOrderId) {
      const isValid = verifyRazorpaySignature({
        orderId: order.gatewayOrderId,
        paymentId: input.paymentId,
        signature: input.signature,
      });

      if (!isValid) {
        return { ok: false, error: "Payment verification failed: Invalid signature." };
      }
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
      tenantId: updatedOrder.tenantId || "spice-saffron",
      timestamp: new Date().toISOString(),
      data: {
        id: updatedOrder.id,
        orderNumber: updatedOrder.orderNumber,
        orderStatus: "CONFIRMED",
        paymentStatus: "PAID",
      },
    });

    // Send customer receipt
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

    revalidatePath(`/order/${updatedOrder.id}`);
    revalidatePath("/admin/orders");
    revalidatePath("/admin/kds");

    return { ok: true, data: { orderId: updatedOrder.id } };
  } catch (error) {
    logger.error({ event: "payment.verify_error", error: String(error) });
    return { ok: false, error: "Failed to confirm payment status." };
  }
}
