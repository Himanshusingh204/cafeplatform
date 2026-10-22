import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db/prisma";
import { enqueueOutboxEvent } from "@/lib/outbox/enqueue";
import { processOutbox } from "@/lib/outbox/process";
import { truncateTables } from "../helpers/db";

let tenantId: string;

async function seedEvent(type = "t.ok", overrides: Record<string, unknown> = {}) {
  return db.outboxEvent.create({ data: { tenantId, type, payload: { a: 1 }, ...overrides } });
}

beforeEach(async () => {
  await truncateTables("OutboxEvent");
  const t = await db.tenant.upsert({
    where: { slug: "outbox-test" },
    update: {},
    create: { slug: "outbox-test", name: "Outbox Test" },
  });
  tenantId = t.id;
});

afterAll(async () => {
  await truncateTables("OutboxEvent");
});

describe("outbox", () => {
  it("rolls back the event with the surrounding transaction", async () => {
    await expect(
      db.$transaction(async (tx) => {
        await enqueueOutboxEvent(tx, { tenantId, type: "t.ok", payload: { a: 1 } });
        throw new Error("order failed");
      })
    ).rejects.toThrow("order failed");
    expect(await db.outboxEvent.count()).toBe(0);

    await db.$transaction((tx) => enqueueOutboxEvent(tx, { tenantId, type: "t.ok", payload: {} }));
    expect(await db.outboxEvent.count()).toBe(1);
  });

  it("marks DONE on success", async () => {
    const e = await seedEvent();
    const handler = vi.fn(async () => {});
    const r = await processOutbox(10, { handlers: { "t.ok": handler } });
    expect(r).toMatchObject({ claimed: 1, done: 1 });
    const row = await db.outboxEvent.findUniqueOrThrow({ where: { id: e.id } });
    expect(row.status).toBe("DONE");
    expect(row.processedAt).not.toBeNull();
    expect((await processOutbox(10, { handlers: { "t.ok": handler } })).claimed).toBe(0);
  });

  it("backs off on failure and goes DEAD after max attempts", async () => {
    const e = await seedEvent();
    const handlers = { "t.ok": async () => { throw new Error("boom"); } };
    await processOutbox(10, { handlers, maxAttempts: 2 });
    let row = await db.outboxEvent.findUniqueOrThrow({ where: { id: e.id } });
    expect(row.status).toBe("PENDING");
    expect(row.attempts).toBe(1);
    expect(row.lastError).toBe("boom");
    expect(row.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
    expect((await processOutbox(10, { handlers, maxAttempts: 2 })).claimed).toBe(0);

    await db.outboxEvent.update({ where: { id: e.id }, data: { nextAttemptAt: new Date(Date.now() - 1000) } });
    const r = await processOutbox(10, { handlers, maxAttempts: 2 });
    expect(r.dead).toBe(1);
    row = await db.outboxEvent.findUniqueOrThrow({ where: { id: e.id } });
    expect(row.status).toBe("DEAD");
    expect(row.attempts).toBe(2);
  });

  it("never double-processes a row across concurrent processors", async () => {
    for (let i = 0; i < 20; i += 1) await seedEvent();
    const seen: string[] = [];
    const handlers = {
      "t.ok": async (_p: unknown, ev: { id: string }) => {
        seen.push(ev.id);
        await new Promise((r) => setTimeout(r, 5));
      },
    };
    await Promise.all([1, 2, 3, 4].map(() => processOutbox(20, { handlers })));
    expect(seen).toHaveLength(20);
    expect(new Set(seen).size).toBe(20);
    expect(await db.outboxEvent.count({ where: { status: "DONE" } })).toBe(20);
  });
});
