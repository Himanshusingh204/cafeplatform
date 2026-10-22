import "server-only";

import { db } from "@/lib/db/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";

export interface OutboxEventInput {
  tenantId: string;
  type: string;
  payload: Prisma.InputJsonValue;
  /** Defer the first attempt; defaults to now. */
  nextAttemptAt?: Date;
}

/** Anything exposing `outboxEvent.create`: the root client or a transaction client. */
type OutboxWriter = { outboxEvent: Pick<typeof db.outboxEvent, "create"> };

/**
 * Write an outbox event. Pass the `tx` of the surrounding transaction so the
 * event commits (or rolls back) atomically with the business row.
 */
export async function enqueueOutboxEvent(writer: OutboxWriter, event: OutboxEventInput) {
  return writer.outboxEvent.create({
    data: {
      tenantId: event.tenantId,
      type: event.type,
      payload: event.payload,
      ...(event.nextAttemptAt ? { nextAttemptAt: event.nextAttemptAt } : {}),
    },
  });
}
