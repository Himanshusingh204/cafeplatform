import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "node:crypto";
import {
  createPaymentOrder,
  verifyRazorpaySignature,
  verifyRazorpayWebhookSignature,
} from "@/lib/payments/engine";

describe("FinTech & Payment Engine", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  describe("createPaymentOrder", () => {
    it("generates a resilient sandbox order with correct paise calculation when no keys set", async () => {
      delete process.env.RAZORPAY_KEY_ID;
      delete process.env.RAZORPAY_KEY_SECRET;
      delete process.env.STRIPE_SECRET_KEY;

      const result = await createPaymentOrder({
        orderId: "ord-test-123",
        orderNumber: "ORD-9999",
        amount: 850, // ₹850
      });

      expect(result.provider).toBe("SIMULATED");
      expect(result.amount).toBe(85000); // 850 * 100 paise
      expect(result.currency).toBe("INR");
      expect(result.isSandbox).toBe(true);
      expect(result.gatewayOrderId).toMatch(/^sim_order_/);
    });
  });

  describe("verifyRazorpaySignature", () => {
    const testSecret = "test_razorpay_secret_key_12345";

    it("accepts a cryptographically valid HMAC-SHA256 signature", () => {
      process.env.RAZORPAY_KEY_SECRET = testSecret;

      const orderId = "order_EKwxwAgItmmXdp";
      const paymentId = "pay_29QQoUBi66xm2f";
      const payload = `${orderId}|${paymentId}`;
      const validSignature = crypto
        .createHmac("sha256", testSecret)
        .update(payload)
        .digest("hex");

      const verified = verifyRazorpaySignature({
        orderId,
        paymentId,
        signature: validSignature,
      });

      expect(verified).toBe(true);
    });

    it("rejects a forged or tampered signature", () => {
      process.env.RAZORPAY_KEY_SECRET = testSecret;

      const orderId = "order_EKwxwAgItmmXdp";
      const paymentId = "pay_29QQoUBi66xm2f";

      const verified = verifyRazorpaySignature({
        orderId,
        paymentId,
        signature: "forged_invalid_signature_hex_digest_here_1234567890",
      });

      expect(verified).toBe(false);
    });

    it("rejects verification in production if RAZORPAY_KEY_SECRET is missing", () => {
      delete process.env.RAZORPAY_KEY_SECRET;
      process.env.NODE_ENV = "production";

      const verified = verifyRazorpaySignature({
        orderId: "order_123",
        paymentId: "pay_123",
        signature: "some_sig",
      });

      expect(verified).toBe(false);
    });
  });

  describe("verifyRazorpayWebhookSignature", () => {
    const testWebhookSecret = "whsec_test_secret_abc123";

    it("verifies genuine webhook raw body and header", () => {
      process.env.RAZORPAY_WEBHOOK_SECRET = testWebhookSecret;

      const rawBody = JSON.stringify({
        event: "payment.captured",
        payload: { payment: { entity: { id: "pay_123", amount: 50000 } } },
      });

      const signature = crypto
        .createHmac("sha256", testWebhookSecret)
        .update(rawBody)
        .digest("hex");

      const isValid = verifyRazorpayWebhookSignature(rawBody, signature);
      expect(isValid).toBe(true);
    });

    it("rejects tampered webhook body with valid signature for different body", () => {
      process.env.RAZORPAY_WEBHOOK_SECRET = testWebhookSecret;

      const rawBody = JSON.stringify({ event: "payment.captured" });
      const tamperedBody = JSON.stringify({ event: "payment.captured", hacked: true });

      const signature = crypto
        .createHmac("sha256", testWebhookSecret)
        .update(rawBody)
        .digest("hex");

      const isValid = verifyRazorpayWebhookSignature(tamperedBody, signature);
      expect(isValid).toBe(false);
    });
  });
});
