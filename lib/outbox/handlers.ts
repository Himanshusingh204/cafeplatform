import "server-only";

import { isEmailConfigured, sendOrderReceipt } from "@/lib/email/notifier";
import { depleteInventoryForOrder } from "@/lib/services/inventory";
import { processLoyaltyForOrder } from "@/lib/services/loyalty";

export const ORDER_RECEIPT_EVENT = "order.receipt";
export const ORDER_INVENTORY_EVENT = "order.inventory";
export const ORDER_LOYALTY_EVENT = "order.loyalty";

export interface OrderReceiptPayload {
  customerName: string;
  customerEmail: string;
  orderNumber: string;
  pickupTime: string;
  total: number;
  items: { dishName: string; quantity: number; price: number }[];
}

export type OutboxHandler = (payload: unknown, event: { id: string; tenantId: string }) => Promise<void>;

/**
 * Handlers must be idempotent: delivery is at-least-once (a crash between the
 * send and the DONE write re-delivers). A receipt is safe to repeat.
 * Deliberately independent of lib/queue/handlers (that module starts a timer).
 */
export const defaultOutboxHandlers: Record<string, OutboxHandler> = {
  [ORDER_RECEIPT_EVENT]: async (payload) => {
    // Email unset => silent no-op success, never a retry storm.
    if (!isEmailConfigured()) return;
    const result = await sendOrderReceipt(payload as OrderReceiptPayload);
    if (!result.sent) throw new Error("Email provider did not accept the receipt.");
  },
  // Retry of a post-order step that failed inline. Each runs in one transaction,
  // so a failed attempt leaves nothing behind and repeating it is safe.
  [ORDER_INVENTORY_EVENT]: async (payload) => {
    await depleteInventoryForOrder((payload as { orderId: string }).orderId);
  },
  [ORDER_LOYALTY_EVENT]: async (payload) => {
    await processLoyaltyForOrder((payload as { orderId: string }).orderId);
  },
};
