import { apiError } from "@/lib/api/errors";
import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyS2SRequest } from "@/lib/auth/s2s";
import { db } from "@/lib/db/prisma";
import { broadcastEvent } from "@/lib/realtime/bus";
import { dispatchWebhook } from "@/lib/webhooks/dispatcher";

export const dynamic = "force-dynamic";

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
/** Hard cap so a single request cannot dump the whole reservations table. */
const RESERVATIONS_LIST_MAX = 500;

/**
 * Parse a `YYYY-MM-DD` string as UTC midnight, rejecting impossible calendar
 * dates (e.g. 2026-02-31) that `Date` would otherwise silently roll over.
 */
function parseDateOnly(value: string): Date | null {
  if (!DATE_ONLY_PATTERN.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  if (parsed.toISOString().slice(0, 10) !== value) return null;
  return parsed;
}

const createReservationSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  phone: z.string().min(8).max(20),
  guests: z.number().int().min(1).max(20),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format must be YYYY-MM-DD"),
  timeSlot: z.string().min(1),
  specialRequests: z.string().max(500).optional(),
});

/**
 * GET /api/v1/reservations
 * Retrieve bookings for tenant with date filtering.
 */
export async function GET(request: Request) {
  const auth = await verifyS2SRequest(request, "reservations:read");
  if (!auth.success) {
    return apiError(auth.status, auth.error);
  }

  const { searchParams } = new URL(request.url);
  const rawDate = searchParams.get("date");
  // Default to today rather than dumping the entire collection.
  const dateStr = rawDate === null || rawDate.trim() === ""
    ? new Date().toISOString().slice(0, 10)
    : rawDate.trim();

  const date = parseDateOnly(dateStr);
  if (!date) {
    return apiError(400, "Invalid date. Expected a real calendar date in YYYY-MM-DD format.");
  }

  const tenantId = auth.context.tenantId;

  const reservations = await db.reservation.findMany({
    where: {
      // Strict tenant equality: legacy rows with a null tenantId are not
      // readable through a tenant-scoped API key.
      tenantId,
      date,
    },
    orderBy: { date: "asc" },
    take: RESERVATIONS_LIST_MAX,
  });

  return NextResponse.json({
    tenantId,
    count: reservations.length,
    reservations,
  });
}

/**
 * POST /api/v1/reservations
 * Ingest partner or concierge table booking.
 */
export async function POST(request: Request) {
  const auth = await verifyS2SRequest(request, "reservations:write");
  if (!auth.success) {
    return apiError(auth.status, auth.error);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "Invalid JSON payload");
  }

  const parsed = createReservationSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(422, "Validation failed", undefined, { details: parsed.error.flatten().fieldErrors });
  }

  const data = parsed.data;
  const tenantId = auth.context.tenantId;

  const randomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
  const referenceCode = `BK-${Date.now().toString().slice(-4)}-${randomCode}`;

  const reservation = await db.reservation.create({
    data: {
      tenantId,
      referenceCode,
      name: data.name,
      email: data.email,
      phone: data.phone,
      guests: data.guests,
      date: new Date(data.date),
      timeSlot: data.timeSlot,
      specialRequests: data.specialRequests,
      status: "CONFIRMED",
    },
  });

  // Real-time broadcast
  broadcastEvent({
    type: "reservation:created",
    tenantId,
    timestamp: new Date().toISOString(),
    data: {
      id: reservation.id,
      referenceCode: reservation.referenceCode,
      name: reservation.name,
      guests: reservation.guests,
      date: reservation.date,
      timeSlot: reservation.timeSlot,
    },
  });

  // Outbound Webhook
  dispatchWebhook({
    event: "reservation.created",
    tenantId,
    data: {
      id: reservation.id,
      referenceCode: reservation.referenceCode,
      name: reservation.name,
      guests: reservation.guests,
      date: reservation.date,
      timeSlot: reservation.timeSlot,
    },
  }).catch(() => {});

  return NextResponse.json(
    {
      message: "Reservation successfully created",
      reservation,
    },
    { status: 201 }
  );
}
