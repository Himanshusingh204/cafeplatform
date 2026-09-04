import "server-only";

import crypto from "node:crypto";
import { logger } from "@/lib/logger";

export type PaymentProvider = "RAZORPAY" | "STRIPE" | "SIMULATED";

export interface CreatePaymentOrderOptions {
  orderId: string;
  orderNumber: string;
  amount: number; // in rupees
  currency?: "INR" | "USD";
}

export interface PaymentOrderResult {
  provider: PaymentProvider;
  gatewayOrderId: string;
  amount: number; // in smallest unit (paise/cents)
  currency: string;
  keyId?: string;
  clientSecret?: string;
  isSandbox: boolean;
}

/**
 * Creates a gateway payment order (Razorpay / Stripe) with automatic sandbox fallback.
 */
export async function createPaymentOrder(
  options: CreatePaymentOrderOptions
): Promise<PaymentOrderResult> {
  const amountPaise = Math.round(options.amount * 100);
  const currency = options.currency || "INR";

  // 1. Try Razorpay if credentials exist
  if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    try {
      const auth = Buffer.from(
        `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
      ).toString("base64");

      const res = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: amountPaise,
          currency,
          receipt: options.orderNumber,
          notes: {
            appOrderId: options.orderId,
            orderNumber: options.orderNumber,
          },
        }),
      });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        throw new Error(`Razorpay API error: ${JSON.stringify(errorJson)}`);
      }

      const data = (await res.json()) as { id: string };
      logger.info({ event: "payment.order_created", provider: "RAZORPAY", orderId: data.id });

      return {
        provider: "RAZORPAY",
        gatewayOrderId: data.id,
        amount: amountPaise,
        currency,
        keyId: process.env.RAZORPAY_KEY_ID,
        isSandbox: process.env.RAZORPAY_KEY_ID.startsWith("rzp_test_"),
      };
    } catch (error) {
      logger.error({ event: "payment.razorpay_failed", error: String(error) });
      // Fall through to simulated fallback if live fails during configuration
    }
  }

  // 2. Try Stripe if secret key exists
  if (process.env.STRIPE_SECRET_KEY) {
    try {
      const res = await fetch("https://api.stripe.com/v1/payment_intents", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          amount: amountPaise.toString(),
          currency: currency.toLowerCase(),
          "metadata[appOrderId]": options.orderId,
          "metadata[orderNumber]": options.orderNumber,
        }).toString(),
      });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        throw new Error(`Stripe API error: ${JSON.stringify(errorJson)}`);
      }

      const data = (await res.json()) as { id: string; client_secret: string };
      return {
        provider: "STRIPE",
        gatewayOrderId: data.id,
        clientSecret: data.client_secret,
        amount: amountPaise,
        currency,
        isSandbox: process.env.STRIPE_SECRET_KEY.startsWith("sk_test_"),
      };
    } catch (error) {
      logger.error({ event: "payment.stripe_failed", error: String(error) });
    }
  }

  // 3. Resilient Sandbox Simulation for Dev / Test Mode
  const simulatedId = `sim_order_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  return {
    provider: "SIMULATED",
    gatewayOrderId: simulatedId,
    amount: amountPaise,
    currency,
    isSandbox: true,
  };
}

/**
 * Constant-time verification of Razorpay client signature.
 */
export function verifyRazorpaySignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      logger.error({
        event: "payment.signature_verify_missing_secret",
        message: "RAZORPAY_KEY_SECRET is required in production environments",
      });
      return false;
    }
    return true; // Accept only in local development mock mode
  }

  try {
    const payload = `${params.orderId}|${params.paymentId}`;
    const expected = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");

    const expectedBuffer = Buffer.from(expected, "utf8");
    const actualBuffer = Buffer.from(params.signature, "utf8");

    if (expectedBuffer.length !== actualBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
  } catch (error) {
    logger.error({ event: "payment.signature_verify_error", error: String(error) });
    return false;
  }
}

/**
 * Constant-time verification of Razorpay Webhook signature header (X-Razorpay-Signature).
 */
export function verifyRazorpayWebhookSignature(
  rawBody: string,
  signatureHeader: string
): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;

  try {
    const expected = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

    const expectedBuffer = Buffer.from(expected, "utf8");
    const actualBuffer = Buffer.from(signatureHeader, "utf8");

    if (expectedBuffer.length !== actualBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
  } catch {
    return false;
  }
}
