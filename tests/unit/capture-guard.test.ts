import { describe, expect, it } from "vitest";
import { captureRejection } from "@/lib/payments/capture-guard";

describe("captureRejection", () => {
  const open = { orderStatus: "PENDING", total: "800.00" };

  it("accepts a capture that matches the total", () => {
    expect(captureRejection(open, 80000)).toBeNull();
  });

  it("rejects an under-payment", () => {
    expect(captureRejection(open, 1000)).toMatch(/does not match/);
  });

  it("rejects a capture for a cancelled or completed order", () => {
    expect(captureRejection({ ...open, orderStatus: "CANCELLED" }, 80000)).toMatch(/cancelled/);
    expect(captureRejection({ ...open, orderStatus: "COMPLETED" }, 80000)).toMatch(/completed/);
  });

  it("does not guess when the gateway sends no amount", () => {
    expect(captureRejection(open, undefined)).toBeNull();
  });
});
