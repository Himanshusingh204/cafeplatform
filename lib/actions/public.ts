"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { rateLimit } from "@/lib/rate-limit/limiter";
import { createReservation, getReservationByCode, type CreateReservationInput } from "@/lib/services/reservations";
import { createOrder, validateCoupon, type CreateOrderInput } from "@/lib/services/orders";
import { createReview, type CreateReviewInput } from "@/lib/services/reviews";
import { sendReservationConfirmation, sendOrderReceipt } from "@/lib/email/notifier";

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

  try {
    const reservation = await createReservation({
      ...input,
      date: new Date(input.date),
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

export async function checkCouponAction(code: string, subtotal: number) {
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

  return await validateCoupon(cleanCode, subtotal);
}

export async function submitTakeawayOrderAction(
  input: CreateOrderInput
): Promise<PublicActionResult<{ id: string; orderNumber: string }>> {
  const ip = await getClientIp();
  const ipLimiter = await rateLimit(`order:ip:${ip}`, 15, 10 * 60 * 1000);
  if (!ipLimiter.success) {
    return { ok: false, error: "Too many order submissions from this connection. Please wait a few minutes." };
  }

  const limiter = await rateLimit(`order:${input.customerEmail}`, 10, 10 * 60 * 1000);
  if (!limiter.success) {
    return { ok: false, error: "Too many order submissions. Please wait a few minutes." };
  }

  if (!input.items || input.items.length === 0) {
    return { ok: false, error: "Your takeaway bag is empty." };
  }
  if (!input.customerName || input.customerName.trim().length < 2) {
    return { ok: false, error: "Please enter your name for pickup." };
  }
  if (!input.customerPhone || input.customerPhone.trim().length < 8) {
    return { ok: false, error: "Please enter a valid phone number for SMS pickup alerts." };
  }

  try {
    const order = await createOrder(input);

    sendOrderReceipt({
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      orderNumber: order.orderNumber,
      pickupTime: order.pickupTime,
      total: Number(order.total),
      items: order.items.map((i) => ({
        dishName: i.dishName,
        quantity: i.quantity,
        price: Number(i.price),
      })),
    }).catch(() => undefined);

    revalidatePath("/admin/orders");
    revalidatePath("/admin");
    return { ok: true, data: { id: order.id, orderNumber: order.orderNumber } };
  } catch (error) {
    console.error("submitTakeawayOrderAction error:", error);
    return { ok: false, error: "Unable to place order. Please try again." };
  }
}

export async function submitReviewAction(
  input: CreateReviewInput
): Promise<PublicActionResult> {
  const limiter = await rateLimit(`review:${input.customerName}`, 3, 15 * 60 * 1000);
  if (!limiter.success) {
    return { ok: false, error: "Too many submissions. Please wait a moment." };
  }

  if (!input.customerName || input.customerName.trim().length < 2) {
    return { ok: false, error: "Please provide your name." };
  }
  if (!input.comment || input.comment.trim().length < 10) {
    return { ok: false, error: "Please write at least a sentence about your dining experience." };
  }

  try {
    await createReview(input);
    revalidatePath("/admin/reviews");
    revalidateTag("reviews", "max");
    return { ok: true };
  } catch (error) {
    console.error("submitReviewAction error:", error);
    return { ok: false, error: "Unable to submit review right now." };
  }
}
