import "server-only";

import { db } from "@/lib/db/prisma";
import type { WaitlistStatus } from "@/lib/generated/prisma/enums";

export interface AddWaitlistInput {
  customerName: string;
  customerPhone: string;
  partySize: number;
  specialNotes?: string;
  tenantId?: string;
}

/**
 * Estimate wait time based on parties currently waiting
 */
export async function calculateEstimatedWait(partySize: number, tenantId?: string): Promise<number> {
  const where = {
    status: "WAITING" as WaitlistStatus,
    ...(tenantId ? { tenantId } : {}),
  };

  const countAhead = await db.waitlistEntry.count({ where });

  // Baseline: 8-12 minutes per party ahead, minimum 10 minutes, adjusted for party size
  const sizeMultiplier = partySize > 4 ? 1.4 : 1.0;
  const estimated = Math.max(10, Math.round(countAhead * 8 * sizeMultiplier));
  return estimated;
}

/**
 * Add a new guest party to the waitlist
 */
export async function addToWaitlist(input: AddWaitlistInput) {
  if (!input.customerName?.trim() || !input.customerPhone?.trim()) {
    throw new Error("Customer name and phone are required.");
  }

  const partySize = Math.max(1, Math.min(20, Math.floor(input.partySize || 2)));
  const estimatedWaitMinutes = await calculateEstimatedWait(partySize, input.tenantId);

  return db.waitlistEntry.create({
    data: {
      customerName: input.customerName.trim(),
      customerPhone: input.customerPhone.trim(),
      partySize,
      specialNotes: input.specialNotes?.trim() || null,
      status: "WAITING",
      estimatedWaitMinutes,
      tenantId: input.tenantId || null,
    },
  });
}

/**
 * Get active waitlist entries (WAITING & NOTIFIED)
 */
export async function getActiveWaitlist(tenantId?: string) {
  const where = {
    status: { in: ["WAITING", "NOTIFIED"] as WaitlistStatus[] },
    ...(tenantId ? { tenantId } : {}),
  };

  return db.waitlistEntry.findMany({
    where,
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Get public waitlist position for a customer
 */
export async function getPublicWaitlistPosition(entryId: string) {
  const entry = await db.waitlistEntry.findUnique({
    where: { id: entryId },
  });

  if (!entry) {
    return null;
  }

  if (entry.status !== "WAITING" && entry.status !== "NOTIFIED") {
    return {
      id: entry.id,
      customerName: entry.customerName,
      partySize: entry.partySize,
      status: entry.status,
      position: 0,
      estimatedWaitMinutes: 0,
    };
  }

  // Count how many WAITING parties were added before this entry
  const aheadCount = await db.waitlistEntry.count({
    where: {
      status: "WAITING",
      createdAt: { lt: entry.createdAt },
      ...(entry.tenantId ? { tenantId: entry.tenantId } : {}),
    },
  });

  return {
    id: entry.id,
    customerName: entry.customerName,
    partySize: entry.partySize,
    status: entry.status,
    position: aheadCount + 1,
    estimatedWaitMinutes: entry.estimatedWaitMinutes,
    createdAt: entry.createdAt,
    notifiedAt: entry.notifiedAt,
  };
}

/**
 * Mark a party as NOTIFIED (e.g. SMS / buzzer sent)
 */
export async function notifyParty(id: string) {
  return db.waitlistEntry.update({
    where: { id },
    data: {
      status: "NOTIFIED",
      notifiedAt: new Date(),
    },
  });
}

/**
 * Seat a party at a table
 */
export async function seatParty(id: string) {
  return db.waitlistEntry.update({
    where: { id },
    data: {
      status: "SEATED",
      seatedAt: new Date(),
    },
  });
}

/**
 * Cancel or remove party from waitlist
 */
export async function cancelWaitlistEntry(id: string) {
  return db.waitlistEntry.update({
    where: { id },
    data: {
      status: "CANCELLED",
    },
  });
}
