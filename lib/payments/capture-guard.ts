/**
 * Decides whether a "payment captured" webhook may mark an order paid.
 * Returns a reason string when it must be ignored, or null when it may proceed.
 * Used by both the Next route and the Express adapter so the rule cannot drift.
 */
export function captureRejection(
  order: { orderStatus: string; total: unknown },
  capturedAmountMinor: unknown
): string | null {
  if (order.orderStatus === "CANCELLED" || order.orderStatus === "COMPLETED") {
    return `Order is ${order.orderStatus.toLowerCase()}`;
  }
  // The gateway reports paise. A mismatch means the capture does not cover this order.
  if (typeof capturedAmountMinor === "number" && capturedAmountMinor !== Math.round(Number(order.total) * 100)) {
    return "Captured amount does not match the order total";
  }
  return null;
}
