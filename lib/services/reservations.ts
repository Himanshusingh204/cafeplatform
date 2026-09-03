import "server-only";

import { db } from "@/lib/db/prisma";
import { logAction } from "@/lib/services/audit";
import type { ReservationStatus } from "@/lib/generated/prisma/enums";

export interface CreateReservationInput {
  name: string;
  email: string;
  phone: string;
  guests: number;
  date: Date;
  timeSlot: string;
  specialRequests?: string;
}

export function generateReferenceCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "RES-";
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function createReservation(input: CreateReservationInput) {
  const referenceCode = generateReferenceCode();

  const reservation = await db.reservation.create({
    data: {
      referenceCode,
      name: input.name.trim(),
      email: input.email.toLowerCase().trim(),
      phone: input.phone.trim(),
      guests: input.guests,
      date: input.date,
      timeSlot: input.timeSlot,
      specialRequests: input.specialRequests?.trim() || null,
      status: "PENDING",
    },
  });

  return reservation;
}

export async function getReservationByCode(referenceCode: string) {
  try {
    return await db.reservation.findUnique({
      where: { referenceCode: referenceCode.toUpperCase().trim() },
    });
  } catch {
    return null;
  }
}

export async function listReservationsAdmin(options?: {
  status?: ReservationStatus;
  date?: string;
  page?: number;
  pageSize?: number;
}) {
  try {
    const page = Math.max(1, options?.page ?? 1);
    const pageSize = Math.max(1, Math.min(100, options?.pageSize ?? 30));
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = {};
    if (options?.status) {
      where.status = options.status;
    }
    if (options?.date) {
      const targetDate = new Date(options.date);
      const start = new Date(targetDate.setHours(0, 0, 0, 0));
      const end = new Date(targetDate.setHours(23, 59, 59, 999));
      where.date = { gte: start, lte: end };
    }

    const [items, total] = await Promise.all([
      db.reservation.findMany({
        where,
        orderBy: [{ date: "asc" }, { timeSlot: "asc" }],
        skip,
        take: pageSize,
      }),
      db.reservation.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  } catch (error) {
    console.error("listReservationsAdmin error:", error);
    return { items: [], total: 0, page: 1, pageSize: 30, totalPages: 0 };
  }
}

export async function updateReservationStatus(
  id: string,
  status: ReservationStatus,
  notes?: string,
  actorId?: string | null
) {
  const updated = await db.reservation.update({
    where: { id },
    data: {
      status,
      notes: notes !== undefined ? notes : undefined,
    },
  });

  await logAction({
    actorId,
    action: "RESERVATION_STATUS_CHANGED",
    entityType: "Reservation",
    entityId: id,
    metadata: { newStatus: status, referenceCode: updated.referenceCode },
  });

  return updated;
}

export async function getReservationStats() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [pendingCount, todayCount, totalSeated] = await Promise.all([
      db.reservation.count({ where: { status: "PENDING" } }),
      db.reservation.count({
        where: {
          date: { gte: today, lt: tomorrow },
          status: { in: ["CONFIRMED", "SEATED"] },
        },
      }),
      db.reservation.count({ where: { status: "SEATED" } }),
    ]);

    return { pendingCount, todayCount, totalSeated };
  } catch (error) {
    console.error("getReservationStats error:", error);
    return { pendingCount: 0, todayCount: 0, totalSeated: 0 };
  }
}
