import "server-only";

import { logger } from "@/lib/logger";
import { site } from "@/config/site";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

interface ContactNotification {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function isContactNotificationConfigured(): boolean {
  return Boolean(process.env.EMAIL_API_KEY && process.env.CONTACT_NOTIFY_EMAIL);
}

function buildBody(input: ContactNotification) {
  const from =
    process.env.EMAIL_FROM_ADDRESS ?? `${site.name} website <onboarding@resend.dev>`;
  const to = process.env.CONTACT_NOTIFY_EMAIL as string;

  const lines = [
    `New contact form submission — ${site.name}`,
    "",
    `Name: ${input.name}`,
    `Email: ${input.email}`,
    input.phone ? `Phone: ${input.phone}` : null,
    "",
    "Message:",
    input.message,
    "",
    "Reply directly to this visitor by email.",
  ].filter((line): line is string => line !== null);

  const html = `
    <div style="font-family:sans-serif;max-width:560px">
      <h2 style="margin:0 0 16px">New contact form submission</h2>
      <p><strong>From:</strong> ${escapeHtml(input.name)} &lt;${escapeHtml(input.email)}&gt;</p>
      ${input.phone ? `<p><strong>Phone:</strong> ${escapeHtml(input.phone)}</p>` : ""}
      <p><strong>Subject:</strong> ${escapeHtml(input.subject)}</p>
      <hr style="border:none;border-top:1px solid #e8e3dc;margin:16px 0" />
      <p style="white-space:pre-line">${escapeHtml(input.message)}</p>
      <hr style="border:none;border-top:1px solid #e8e3dc;margin:16px 0" />
      <p style="color:#6b645c;font-size:13px">Reply directly to this visitor by email.</p>
    </div>
  `;

  return {
    from,
    to,
    reply_to: input.email,
    subject: `[Contact] ${input.subject}`,
    text: lines.join("\n"),
    html,
  };
}

/**
 * Best-effort notification: a failed email must never fail a stored message.
 * Returns whether the notification was actually sent.
 */
export async function sendContactNotification(
  input: ContactNotification
): Promise<{ sent: boolean }> {
  if (!isContactNotificationConfigured()) return { sent: false };

  const apiKey = process.env.EMAIL_API_KEY as string;

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildBody(input)),
    });

    if (!response.ok) {
      logger.error({
        event: "contact.notify",
        result: "failed",
        status: response.status,
      });
      return { sent: false };
    }

    logger.info({ event: "contact.notify", result: "success" });
    return { sent: true };
  } catch (error) {
    logger.error({
      event: "contact.notify",
      result: "failed",
      error: String(error),
    });
    return { sent: false };
  }
}
