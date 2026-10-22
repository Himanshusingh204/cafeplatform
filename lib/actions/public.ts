"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { getIpHash } from "@/lib/api/request";
import { resolveTenant } from "@/lib/db/tenant";
import { rateLimit } from "@/lib/rate-limit/limiter";
import { cancelReservationForCustomer, createReservation, getReservationByCode, type CreateReservationInput } from "@/lib/services/reservations";
import {
  createOrder,
  publicOrderInputSchema,
  validateCoupon,
  type CreateOrderInput,
  type CouponValidationResult,
} from "@/lib/services/orders";
import { createReview, type CreateReviewInput } from "@/lib/services/reviews";
import { PlanLimitError } from "@/lib/plans";
import { sendReservationConfirmation } from "@/lib/email/notifier";

export interface PublicActionResult<T = unknown> {
  ok: boolean;
  error?: string;
  data?: T;
}

async function getClientIp(): Promise<string> {
  try {
    const headerList = await headers();
    const forwarded = headerList.get("x-forwarded-for");
    if (forwarded) return forwarded.split(",")[0].trim();
    return headerList.get("x-real-ip") || "unknown-ip";
  } catch {
    return "unknown-ip";
  }
}

/**
 * Accepts only a strict `YYYY-MM-DD` calendar date. Anything else (an invalid
 * string, a random Date, `2026-02-31`) is rejected here so it never reaches
 * Prisma as an `Invalid Date`.
 */
function parseReservationDate(value: unknown): Date | null {
  const raw =
    typeof value === "string"
      ? value.trim()
      : value instanceof Date && !Number.isNaN(value.getTime())
        ? value.toISOString().slice(0, 10)
        : "";

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  // Round-trip guard: `new Date(2026, 1, 31)` silently becomes 3 March.
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

export async function submitReservationAction(
  input: CreateReservationInput
): Promise<PublicActionResult<{ referenceCode: string }>> {
  const ip = await getClientIp();
  const ipLimiter = await rateLimit(`reservation:ip:${ip}`, 10, 10 * 60 * 1000);
  if (!ipLimiter.success) {
    return { ok: false, error: "Too many reservation requests from this connection. Please try again shortly." };
  }

  const limiter = await rateLimit(`reservation:${input.email}`, 5, 10 * 60 * 1000);
  if (!limiter.success) {
    return { ok: false, error: "Too many reservation requests. Please try again shortly." };
  }

  if (!input.name || input.name.trim().length < 2) {
    return { ok: false, error: "Please provide your full name." };
  }
  if (!input.email || !/^\S+@\S+\.\S+$/.test(input.email)) {
    return { ok: false, error: "Please provide a valid email address." };
  }
  if (!input.phone || input.phone.trim().length < 8) {
    return { ok: false, error: "Please provide a valid contact number." };
  }
  if (!input.guests || input.guests < 1 || input.guests > 20) {
    return { ok: false, error: "Party size must be between 1 and 20 guests." };
  }
  if (!input.date || !input.timeSlot) {
    return { ok: false, error: "Please select a booking date and time slot." };
  }

  const bookingDate = parseReservationDate(input.date);
  if (!bookingDate) {
    return { ok: false, error: "Please choose a valid booking date (YYYY-MM-DD)." };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (bookingDate < today) {
    return { ok: false, error: "Please choose today or a future date for your booking." };
  }

  try {
    const reservation = await createReservation({
      ...input,
      date: bookingDate,
    });

    sendReservationConfirmation({
      name: reservation.name,
      email: reservation.email,
      referenceCode: reservation.referenceCode,
      date: reservation.date.toISOString().split("T")[0],
      timeSlot: reservation.timeSlot,
      guests: reservation.guests,
    }).catch(() => undefined);

    revalidatePath("/admin/reservations");
    revalidatePath("/admin");
    return { ok: true, data: { referenceCode: reservation.referenceCode } };
  } catch (error) {
    console.error("submitReservationAction error:", error);
    return { ok: false, error: "Unable to process booking right now. Please call us directly." };
  }
}

export async function lookupReservationAction(
  referenceCode: string
): Promise<PublicActionResult<{
  referenceCode: string;
  name: string;
  guests: number;
  date: string;
  timeSlot: string;
  status: string;
  specialRequests?: string | null;
}>> {
  const cleanCode = referenceCode?.trim().toUpperCase();
  if (!cleanCode || !/^[A-Z0-9-]{4,30}$/.test(cleanCode)) {
    return { ok: false, error: "Please enter a valid booking reference code." };
  }

  // Rate limit by client IP to defend against brute-force reservation code enumeration
  const ip = await getClientIp();
  const ipLimiter = await rateLimit(`lookup:ip:${ip}`, 15, 60 * 1000);
  if (!ipLimiter.success) {
    return { ok: false, error: "Too many lookup requests. Please wait a moment." };
  }

  try {
    const reservation = await getReservationByCode(cleanCode);
    if (!reservation) {
      return { ok: false, error: "No reservation found with this reference code." };
    }

    return {
      ok: true,
      data: {
        referenceCode: reservation.referenceCode,
        name: reservation.name,
        guests: reservation.guests,
        date: reservation.date.toISOString().split("T")[0],
        timeSlot: reservation.timeSlot,
        status: reservation.status,
        specialRequests: reservation.specialRequests,
      },
    };
  } catch (error) {
    console.error("lookupReservationAction error:", error);
    return { ok: false, error: "Failed to look up reservation details." };
  }
}

export async function cancelReservationAction(
  code: string,
  email: string
): Promise<{ success: boolean; error?: string }> {
  const cleanCode = code?.trim().toUpperCase();
  const cleanEmail = email?.trim().toLowerCase();
  if (!cleanCode || !/^[A-Z0-9-]{4,30}$/.test(cleanCode)) {
    return { success: false, error: "Please enter a valid booking reference code." };
  }
  if (!cleanEmail || cleanEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return { success: false, error: "Please enter the email address used for the booking." };
  }

  const ip = await getClientIp();
  const ipLimiter = await rateLimit(`cancel:ip:${ip}`, 10, 60 * 1000);
  if (!ipLimiter.success) {
    return { success: false, error: "Too many requests. Please wait a moment." };
  }

  try {
    const outcome = await cancelReservationForCustomer(cleanCode, cleanEmail);
    switch (outcome) {
      case "cancelled":
      case "already_cancelled":
        revalidatePath("/admin/reservations");
        return { success: true };
      case "not_cancellable":
        return { success: false, error: "This booking can no longer be cancelled online. Please call us." };
      default:
        return { success: false, error: "We could not find a booking with that reference and email." };
    }
  } catch (error) {
    console.error("cancelReservationAction error:", error);
    return { success: false, error: "Unable to cancel right now. Please call us directly." };
  }
}

export async function checkCouponAction(
  code: string,
  subtotal: number
): Promise<CouponValidationResult> {
  const cleanCode = code?.trim().toUpperCase();
  if (!cleanCode || cleanCode.length < 2) {
    return { valid: false, message: "Invalid coupon code format." };
  }

  // Rate limit coupon checking by IP to prevent dictionary / brute-force attacks on promo codes
  const ip = await getClientIp();
  const limiter = await rateLimit(`coupon:ip:${ip}`, 20, 60 * 1000);
  if (!limiter.success) {
    return { valid: false, message: "Too many coupon attempts. Please wait a moment." };
  }

  return await validateCoupon(cleanCode, subtotal, (await resolveTenant()).id);
}

export async function submitTakeawayOrderAction(
  input: CreateOrderInput
): Promise<PublicActionResult<{ id: string; orderNumber: string }>> {
  // Treat everything from the browser as untrusted. Only the public fields are
  // read; `paymentStatus`, `tenantId` and all money totals are stripped here,
  // so an anonymous caller cannot mark an order paid or bill another tenant.
  const parsed = publicOrderInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Please check your order details and try again.",
    };
  }
  const payload = parsed.data;

  const ip = await getClientIp();
  const ipLimiter = await rateLimit(`order:ip:${ip}`, 15, 10 * 60 * 1000);
  if (!ipLimiter.success) {
    return { ok: false, error: "Too many order submissions from this connection. Please wait a few minutes." };
  }

  const limiter = await rateLimit(`order:${payload.customerEmail.toLowerCase()}`, 10, 10 * 60 * 1000);
  if (!limiter.success) {
    return { ok: false, error: "Too many order submissions. Please wait a few minutes." };
  }

  if (!payload.items || payload.items.length === 0) {
    return { ok: false, error: "Your takeaway bag is empty." };
  }

  try {
    const tenant = await resolveTenant();
    const order = await createOrder({
      ...payload,
      tenantId: tenant.id,
      allowAdHoc: false,
    });

    // The receipt is queued by createOrder through the outbox; sending here too would double-mail.
    revalidatePath("/admin/orders");
    revalidatePath("/admin");
    return { ok: true, data: { id: order.id, orderNumber: order.orderNumber } };
  } catch (error) {
    if (error instanceof PlanLimitError) {
      return { ok: false, error: "This venue is not accepting online orders right now. Please call us." };
    }
    console.error("submitTakeawayOrderAction error:", error);
    return { ok: false, error: "Unable to place order. Please try again." };
  }
}

export async function submitReviewAction(
  input: CreateReviewInput
): Promise<PublicActionResult> {
  // Key the primary limiter on the connection, not on a value the attacker can
  // rotate for free. The name bucket stays as a secondary per-author cap.
  const ipHash = (await getIpHash()) ?? (await getClientIp());
  const ipLimiter = await rateLimit(`review:ip:${ipHash}`, 10, 15 * 60 * 1000);
  if (!ipLimiter.success) {
    return { ok: false, error: "Too many submissions. Please wait a moment." };
  }

  const nameLimiter = await rateLimit(`review:${input.customerName?.trim().toLowerCase() || "anonymous"}`, 3, 15 * 60 * 1000);
  if (!nameLimiter.success) {
    return { ok: false, error: "Too many submissions. Please wait a moment." };
  }

  if (!input.customerName || input.customerName.trim().length < 2) {
    return { ok: false, error: "Please provide your name." };
  }
  if (!input.comment || input.comment.trim().length < 10) {
    return { ok: false, error: "Please write at least a sentence about your dining experience." };
  }

  try {
    const tenant = await resolveTenant();
    await createReview(tenant.id, input);
    revalidatePath("/admin/reviews");
    revalidateTag("reviews", "max");
    return { ok: true };
  } catch (error) {
    console.error("submitReviewAction error:", error);
    return { ok: false, error: "Unable to submit review right now." };
  }
}
