import { beforeEach, describe, expect, it, vi } from "vitest";

const { orderFindUnique, orderUpdate, createPaymentOrder, verifyRazorpaySignature } = vi.hoisted(
  () => ({
    orderFindUnique: vi.fn(),
    orderUpdate: vi.fn(),
    createPaymentOrder: vi.fn(),
    verifyRazorpaySignature: vi.fn(),
  })
);

vi.mock("@/lib/db/prisma", () => ({
  db: { order: { findUnique: orderFindUnique, update: orderUpdate } },
}));
vi.mock("@/lib/payments/engine", () => ({ createPaymentOrder, verifyRazorpaySignature }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/realtime/bus", () => ({ broadcastEvent: vi.fn() }));
vi.mock("@/lib/email/notifier", () => ({ sendOrderReceipt: vi.fn() }));

import {
  initiateOrderPaymentAction,
  verifyClientPaymentAction,
} from "@/lib/actions/payments";

function order(overrides: Record<string, unknown> = {}) {
  return {
    id: "order-1",
    orderNumber: "ORD-1",
    total: 500,
    paymentStatus: "PENDING",
    orderStatus: "PENDING",
    createdAt: new Date(),
    gatewayOrderId: null,
    customerName: "Asha",
    customerEmail: "asha@example.com",
    customerPhone: "9999999999",
    pickupTime: "19:00",
    items: [],
    ...overrides,
  };
}

const HOUR = 60 * 60 * 1000;

describe("payment actions order-state guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createPaymentOrder.mockResolvedValue({
      provider: "SIMULATED",
      gatewayOrderId: "sim_order_1",
      amount: 50000,
      currency: "INR",
      isSandbox: true,
    });
    orderUpdate.mockResolvedValue(order());
  });

  it("refuses to initiate payment for an already PAID order", async () => {
    orderFindUnique.mockResolvedValue(order({ paymentStatus: "PAID" }));
    const result = await initiateOrderPaymentAction("order-1");
    expect(result).toEqual({ ok: false, error: "Order is already paid." });
    expect(createPaymentOrder).not.toHaveBeenCalled();
  });

  it("refuses to initiate payment for a CANCELLED order", async () => {
    orderFindUnique.mockResolvedValue(order({ orderStatus: "CANCELLED" }));
    const result = await initiateOrderPaymentAction("order-1");
    expect(result.ok).toBe(false);
    expect(createPaymentOrder).not.toHaveBeenCalled();
  });

  it("refuses to initiate payment for a stale order", async () => {
    orderFindUnique.mockResolvedValue(order({ createdAt: new Date(Date.now() - 5 * HOUR) }));
    const result = await initiateOrderPaymentAction("order-1");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("expired");
    expect(createPaymentOrder).not.toHaveBeenCalled();
  });

  it("refuses to initiate payment for a missing order", async () => {
    orderFindUnique.mockResolvedValue(null);
    const result = await initiateOrderPaymentAction("missing");
    expect(result).toEqual({ ok: false, error: "Order not found." });
    expect(createPaymentOrder).not.toHaveBeenCalled();
  });

  it("still initiates payment for a fresh unpaid order (checkout flow intact)", async () => {
    orderFindUnique.mockResolvedValue(order());
    const result = await initiateOrderPaymentAction("order-1");
    expect(result.ok).toBe(true);
    expect(createPaymentOrder).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: "order-1", amount: 500 })
    );
    expect(orderUpdate).toHaveBeenCalled();
  });

  it("never marks a CANCELLED order as paid, even with a valid signature", async () => {
    orderFindUnique.mockResolvedValue(
      order({ orderStatus: "CANCELLED", gatewayOrderId: "sim_order_1" })
    );
    verifyRazorpaySignature.mockReturnValue(true);

    const result = await verifyClientPaymentAction({
      orderId: "order-1",
      paymentId: "pay_1",
      signature: "sig",
    });

    expect(result.ok).toBe(false);
    expect(verifyRazorpaySignature).not.toHaveBeenCalled();
    expect(orderUpdate).not.toHaveBeenCalled();
  });
});
