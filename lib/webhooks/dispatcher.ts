import crypto from "node:crypto";
import { db } from "@/lib/db/prisma";

export interface WebhookEventPayload {
  event: "order.created" | "order.status_changed" | "reservation.created";
  tenantId: string;
  data: Record<string, unknown>;
}

/**
 * Computes an HMAC-SHA256 signature for a webhook payload.
 */
export function signWebhookPayload(payload: string, secret: string, timestamp: number): string {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(`${timestamp}.${payload}`);
  return `t=${timestamp},v1=${hmac.digest("hex")}`;
}

/**
 * Dispatches a webhook event asynchronously to all subscribed partner URLs for a tenant.
 */
export async function dispatchWebhook(eventPayload: WebhookEventPayload): Promise<void> {
  const subscriptions = await db.webhookSubscription.findMany({
    where: {
      tenantId: eventPayload.tenantId,
      isActive: true,
    },
  });

  if (subscriptions.length === 0) return;

  const serializedData = JSON.stringify({
    event: eventPayload.event,
    tenantId: eventPayload.tenantId,
    timestamp: new Date().toISOString(),
    data: eventPayload.data,
  });

  const timestamp = Math.floor(Date.now() / 1000);

  for (const sub of subscriptions) {
    if (sub.events.length > 0 && !sub.events.includes(eventPayload.event) && !sub.events.includes("*")) {
      continue;
    }

    const signature = signWebhookPayload(serializedData, sub.secret, timestamp);

    // Asynchronously dispatch without blocking
    (async () => {
      let status: "SUCCESS" | "FAILED" = "SUCCESS";
      let responseCode: number | null = null;
      let errorMessage: string | null = null;

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        const res = await fetch(sub.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Spice-Signature": signature,
            "X-Spice-Event": eventPayload.event,
            "User-Agent": "SpicePlatform-Webhook/2.0",
          },
          body: serializedData,
          signal: controller.signal,
        });

        clearTimeout(timeout);
        responseCode = res.status;
        if (!res.ok) {
          status = "FAILED";
          errorMessage = `HTTP status ${res.status}`;
        }
      } catch (err: unknown) {
        status = "FAILED";
        errorMessage = err instanceof Error ? err.message : "Network error";
      }

      await db.webhookDelivery.create({
        data: {
          subscriptionId: sub.id,
          event: eventPayload.event,
          payload: JSON.parse(serializedData),
          responseCode,
          status,
          error: errorMessage,
        },
      }).catch(() => {});
    })();
  }
}
