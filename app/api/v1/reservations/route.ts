import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyS2SRequest } from "@/lib/auth/s2s";
import { db } from "@/lib/db/prisma";
import { broadcastEvent } from "@/lib/realtime/bus";
import { dispatchWebhook } from "@/lib/webhooks/dispatcher";

export const dynamic = "force-dynamic";

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
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const dateStr = searchParams.get("date");
  const tenantId = auth.context.tenantId;

  const reservations = await db.reservation.findMany({
    where: {
      OR: [{ tenantId }, { tenantId: null }],
      ...(dateStr ? { date: new Date(dateStr) } : {}),
    },
    orderBy: { date: "asc" },
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
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const parsed = createReservationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
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
