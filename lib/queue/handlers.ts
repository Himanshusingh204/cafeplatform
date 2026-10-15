import { globalJobQueue, type JobHandler } from "./job-queue";
import { broadcastEvent } from "@/lib/realtime/bus";
import { logger } from "@/lib/logger";
import { escapeHtml, isEmailConfigured, sendEmail } from "@/lib/email/notifier";

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
  html?: string;
  orderNumber?: string;
}

/**
 * KDS realtime fan-out. Re-broadcasts an event onto the tenant event bus so
 * every connected kitchen display receives it.
 */
export const kdsBroadcastHandler: JobHandler<unknown> = async (payload) => {
  broadcastEvent(payload as Parameters<typeof broadcastEvent>[0]);
};

/**
 * Outbound webhook delivery with an HMAC signature and a hard timeout.
 * Throws on a non-2xx response so the queue retries with backoff and
 * eventually routes the job to the dead-letter queue.
 */
export const outboundWebhookHandler: JobHandler<OutboundWebhookPayload> = async (payload) => {
  const bodyStr = JSON.stringify(payload.data);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "SpiceAndSaffron-Webhook/2.0",
  };

  if (payload.secret) {
    const crypto = await import("node:crypto");
    const signature = crypto.createHmac("sha256", payload.secret).update(bodyStr).digest("hex");
    headers["X-Webhook-Signature"] = signature;
  }

  const res = await fetch(payload.url, {
    method: "POST",
    headers,
    body: bodyStr,
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    throw new Error(`Webhook endpoint ${payload.url} responded with status ${res.status}`);
  }

  logger.info({
    event: "webhook.delivered",
    targetUrl: payload.url,
    eventType: payload.event,
  });
};

/**
 * Transactional email dispatch.
 *
 * When no email provider is configured the job is a no-op (retrying it can
 * never succeed), so it is logged loudly rather than looping in the DLQ.
 * When the provider IS configured but rejects the send, the job throws so the
 * queue retries with backoff and the failure is visible in the DLQ.
 */
export const emailDispatchHandler: JobHandler<EmailJobPayload> = async (email) => {
  if (!isEmailConfigured()) {
    logger.warn({
      event: "email.skipped",
      reason: "EMAIL_API_KEY not configured",
      recipient: email.to,
      orderNumber: email.orderNumber,
    });
    return;
  }

  const result = await sendEmail({
    to: email.to,
    subject: email.subject,
    html: email.html ?? `<p>${escapeHtml(email.body)}</p>`,
    text: email.body,
  });

  if (!result.sent) {
    throw new Error(`Email dispatch failed for ${email.to}`);
  }

  logger.info({
    event: "email.dispatched",
    recipient: email.to,
    subject: email.subject,
    orderNumber: email.orderNumber,
  });
};

/**
 * Register core background worker handlers.
 */
export function registerDefaultJobHandlers(): void {
  globalJobQueue.registerHandler("KDS_BROADCAST", kdsBroadcastHandler);
  globalJobQueue.registerHandler("WEBHOOK_OUTBOUND", outboundWebhookHandler);
  globalJobQueue.registerHandler("EMAIL_DISPATCH", emailDispatchHandler);
}

// Automatically register default handlers on module load
registerDefaultJobHandlers();
