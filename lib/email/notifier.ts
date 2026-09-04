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

export async function sendReservationConfirmation(input: {
  name: string;
  email: string;
  referenceCode: string;
  date: string;
  timeSlot: string;
  guests: number;
}): Promise<{ sent: boolean }> {
  if (!process.env.EMAIL_API_KEY) return { sent: false };

  const from = process.env.EMAIL_FROM_ADDRESS ?? `${site.name} <onboarding@resend.dev>`;
  const html = `
    <div style="font-family:sans-serif;max-width:560px;color:#222">
      <h2 style="margin:0 0 8px;color:#7a1d1d">Table Reservation Confirmed</h2>
      <p>Namaste <strong>${escapeHtml(input.name)}</strong>,</p>
      <p>We are delighted to confirm your table reservation at <strong>${site.name}</strong>.</p>
      <div style="background:#fdf9f5;border:1px solid #ebdccc;border-radius:8px;padding:16px;margin:16px 0">
        <p style="margin:0 0 8px;font-size:12px;color:#777;text-transform:uppercase">Booking Reference</p>
        <p style="margin:0 0 16px;font-size:24px;font-weight:bold;color:#7a1d1d;letter-spacing:2px">${escapeHtml(input.referenceCode)}</p>
        <p style="margin:4px 0"><strong>Date:</strong> ${escapeHtml(input.date)}</p>
        <p style="margin:4px 0"><strong>Time:</strong> ${escapeHtml(input.timeSlot)}</p>
        <p style="margin:4px 0"><strong>Party Size:</strong> ${input.guests} ${input.guests === 1 ? "Guest" : "Guests"}</p>
        <p style="margin:4px 0"><strong>Location:</strong> ${escapeHtml(site.address)}</p>
      </div>
      <p style="font-size:13px;color:#666">We hold tables for 15 minutes past your booking time. If your plans change, please give us a ring at ${escapeHtml(site.phone)}.</p>
    </div>
  `;

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.EMAIL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: input.email,
        subject: `Table Reservation Confirmed (${input.referenceCode}) — ${site.name}`,
        html,
      }),
    });
    return { sent: res.ok };
  } catch {
    return { sent: false };
  }
}

export async function sendOrderReceipt(input: {
  customerName: string;
  customerEmail: string;
  orderNumber: string;
  pickupTime: string;
  total: number;
  items: { dishName: string; quantity: number; price: number }[];
}): Promise<{ sent: boolean }> {
  if (!process.env.EMAIL_API_KEY) return { sent: false };

  const from = process.env.EMAIL_FROM_ADDRESS ?? `${site.name} <onboarding@resend.dev>`;
  const itemsHtml = input.items
    .map(
      (item) =>
        `<tr><td style="padding:6px 0">${escapeHtml(item.dishName)} × ${item.quantity}</td><td style="text-align:right;padding:6px 0">₹${item.price * item.quantity}</td></tr>`
    )
    .join("");

  const html = `
    <div style="font-family:sans-serif;max-width:560px;color:#222">
      <h2 style="margin:0 0 8px;color:#7a1d1d">Takeaway Order Receipt</h2>
      <p>Thank you for ordering with <strong>${site.name}</strong>, ${escapeHtml(input.customerName)}!</p>
      <div style="background:#fdf9f5;border:1px solid #ebdccc;border-radius:8px;padding:16px;margin:16px 0">
        <p style="margin:0 0 8px;font-size:12px;color:#777;text-transform:uppercase">Order Number</p>
        <p style="margin:0 0 12px;font-size:22px;font-weight:bold;color:#7a1d1d">${escapeHtml(input.orderNumber)}</p>
        <p style="margin:4px 0"><strong>Estimated Pickup:</strong> ${escapeHtml(input.pickupTime)}</p>
        <hr style="border:none;border-top:1px solid #ebdccc;margin:12px 0" />
        <table style="width:100%;font-size:13px">
          ${itemsHtml}
          <tr style="font-weight:bold;border-top:1px solid #ebdccc">
            <td style="padding:8px 0">Total Amount</td>
            <td style="text-align:right;padding:8px 0">₹${input.total}</td>
          </tr>
        </table>
      </div>
      <p style="font-size:13px;color:#666">Your meal is being prepared fresh in our kitchen. Please show your order number at the counter upon arrival.</p>
    </div>
  `;

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.EMAIL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: input.customerEmail,
        subject: `Your Order Receipt (${input.orderNumber}) — ${site.name}`,
        html,
      }),
    });
    return { sent: res.ok };
  } catch {
    return { sent: false };
  }
}
