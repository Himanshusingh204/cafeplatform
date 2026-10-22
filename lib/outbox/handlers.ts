import "server-only";

import { isEmailConfigured, sendOrderReceipt } from "@/lib/email/notifier";

export const ORDER_RECEIPT_EVENT = "order.receipt";

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
};
