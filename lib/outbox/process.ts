import "server-only";

import { db } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import { recordOutboxDead, recordOutboxProcessed } from "@/lib/observability/metrics";
import { defaultOutboxHandlers, type OutboxHandler } from "./handlers";

export const OUTBOX_MAX_ATTEMPTS = 6;
/** A claimed row not finished within this window is considered abandoned and reclaimable. */
export const OUTBOX_LEASE_MS = 2 * 60_000;
const BASE_BACKOFF_MS = 30_000;
const MAX_BACKOFF_MS = 60 * 60_000;

export function outboxBackoffMs(attempts: number): number {
  return Math.min(BASE_BACKOFF_MS * 2 ** Math.max(0, attempts - 1), MAX_BACKOFF_MS);
}

interface ClaimedRow {
  id: string;
  tenantId: string;
  type: string;
  payload: unknown;
  attempts: number;
}

export interface ProcessOutboxResult {
  claimed: number;
  done: number;
  retried: number;
  dead: number;
}

export interface ProcessOutboxOptions {
  handlers?: Record<string, OutboxHandler>;
  maxAttempts?: number;
}

/**
 * Claim up to `limit` due rows (PENDING, or PROCESSING with an expired lease)
 * using FOR UPDATE SKIP LOCKED, so concurrent drainers never take the same row,
 * then run handlers outside the claim transaction.
 */
export async function processOutbox(
  limit = 10,
  options: ProcessOutboxOptions = {}
): Promise<ProcessOutboxResult> {
  const handlers = options.handlers ?? defaultOutboxHandlers;
  const maxAttempts = options.maxAttempts ?? OUTBOX_MAX_ATTEMPTS;
  const take = Math.max(1, Math.min(Math.floor(limit), 100));
  const leaseUntil = new Date(Date.now() + OUTBOX_LEASE_MS);

  const rows = await db.$transaction(async (tx) =>
    tx.$queryRaw<ClaimedRow[]>`
      UPDATE "OutboxEvent" SET
        "status" = 'PROCESSING',
        "attempts" = "attempts" + 1,
        "nextAttemptAt" = ${leaseUntil}
      WHERE "id" IN (
        SELECT "id" FROM "OutboxEvent"
        WHERE "status" IN ('PENDING', 'PROCESSING') AND "nextAttemptAt" <= ${new Date()}
        ORDER BY "nextAttemptAt" ASC
        LIMIT ${take}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING "id", "tenantId", "type", "payload", "attempts"`
  );

  const result: ProcessOutboxResult = { claimed: rows.length, done: 0, retried: 0, dead: 0 };

  for (const row of rows) {
    try {
      const handler = handlers[row.type];
      if (!handler) throw new Error(`No outbox handler for type '${row.type}'`);
      await handler(row.payload, { id: row.id, tenantId: row.tenantId });
      await db.outboxEvent.update({
        where: { id: row.id },
        data: { status: "DONE", processedAt: new Date(), lastError: null },
      });
      result.done += 1;
    } catch (error) {
      const message = (error instanceof Error ? error.message : String(error)).slice(0, 1000);
      const dead = row.attempts >= maxAttempts;
      await db.outboxEvent.update({
        where: { id: row.id },
        data: dead
          ? { status: "DEAD", lastError: message, processedAt: new Date() }
          : {
              status: "PENDING",
              lastError: message,
              nextAttemptAt: new Date(Date.now() + outboxBackoffMs(row.attempts)),
            },
      });
      if (dead) result.dead += 1;
      else result.retried += 1;
      logger.error({ event: "outbox.failed", id: row.id, type: row.type, dead, error: message });
    }
  }

  recordOutboxProcessed(result.done);
  recordOutboxDead(result.dead);
  return result;
}
