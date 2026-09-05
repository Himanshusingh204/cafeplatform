import { globalJobQueue } from "./job-queue";
import { broadcastEvent } from "@/lib/realtime/bus";
import { logger } from "@/lib/logger";

export interface OutboundWebhookPayload {
  url: string;
  secret: string;
  event: string;
  data: unknown;
}

export interface EmailJobPayload {
  to: string;
  subject: string;
  body: string;
  orderNumber?: string;
}

/**
 * Register core background worker handlers.
 */
export function registerDefaultJobHandlers(): void {
  // 1. KDS Realtime Broadcast Worker
  globalJobQueue.registerHandler("KDS_BROADCAST", async (payload: unknown) => {
    const event = payload as Parameters<typeof broadcastEvent>[0];
    broadcastEvent(event);
  });

  // 2. Outbound Webhook Worker with retry & backoff
  globalJobQueue.registerHandler("WEBHOOK_OUTBOUND", async (payload: unknown) => {
    const data = payload as OutboundWebhookPayload;
    const bodyStr = JSON.stringify(data.data);

    // Compute HMAC if secret is provided
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "SpiceAndSaffron-Webhook/2.0",
    };

    if (data.secret) {
      const crypto = await import("node:crypto");
      const signature = crypto.createHmac("sha256", data.secret).update(bodyStr).digest("hex");
      headers["X-Webhook-Signature"] = signature;
    }

    const res = await fetch(data.url, {
      method: "POST",
      headers,
      body: bodyStr,
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      throw new Error(`Webhook endpoint ${data.url} responded with status ${res.status}`);
    }

    logger.info({
      event: "webhook.delivered",
      targetUrl: data.url,
      eventType: data.event,
    });
  });

  // 3. Email Dispatch Worker
  globalJobQueue.registerHandler("EMAIL_DISPATCH", async (payload: unknown) => {
    const email = payload as EmailJobPayload;
    // Log dispatch (or delegate to nodemailer/resend in production)
    logger.info({
      event: "email.dispatched",
      recipient: email.to,
      subject: email.subject,
      orderNumber: email.orderNumber,
    });
  });
}

// Automatically register default handlers on module load
registerDefaultJobHandlers();
