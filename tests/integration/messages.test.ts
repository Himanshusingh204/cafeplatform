import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@/lib/db/prisma";
import {
  createContactMessage,
  getMessageStats,
  listMessagesAdmin,
  updateMessageStatus,
} from "@/lib/services/messages";
import { truncateTables, uniqueSuffix } from "../helpers/db";

beforeAll(async () => {
  await truncateTables("ActivityLog", "ContactMessage");
});

afterAll(async () => {
  await truncateTables("ActivityLog", "ContactMessage");
});

function messageInput() {
  const suffix = uniqueSuffix();
  return {
    name: `Test Sender ${suffix}`,
    email: `sender-${suffix}@test.example`,
    subject: `Enquiry ${suffix}`,
    message: "Do you serve vegan thali on weekends?",
    ipHash: "a".repeat(64),
  };
}

describe("contact messages", () => {
  it("persists a submission with NEW status by default", async () => {
    const input = messageInput();
    const created = await createContactMessage(input);

    expect(created.status).toBe("NEW");
    expect(created.email).toBe(input.email);
    expect(created.ipHash).toBe(input.ipHash);
    expect(created.phone).toBeNull();
  });

  it("moves through the status workflow with an audit entry", async () => {
    const created = await createContactMessage(messageInput());

    const read = await updateMessageStatus(created.id, "READ");
    const replied = await updateMessageStatus(created.id, "REPLIED", null);

    expect(read.status).toBe("READ");
    expect(replied.status).toBe("REPLIED");

    const logs = await db.activityLog.findMany({
      where: { entityType: "MESSAGE", entityId: created.id },
    });
    expect(logs).toHaveLength(2);
    expect(logs.every((log) => log.action === "MESSAGE_STATUS_CHANGED")).toBe(true);
  });

  it("throws NOT_FOUND for a missing message id", async () => {
    await expect(
      updateMessageStatus("00000000-0000-0000-0000-000000000000", "READ")
    ).rejects.toThrow("NOT_FOUND");
  });

  it("filters and paginates the admin list", async () => {
    const first = await createContactMessage(messageInput());
    const second = await createContactMessage(messageInput());
    await updateMessageStatus(second.id, "ARCHIVED");

    const archived = await listMessagesAdmin({ status: "ARCHIVED" });
    expect(archived.items.map((m) => m.id)).toContain(second.id);
    expect(archived.items.map((m) => m.id)).not.toContain(first.id);

    const search = await listMessagesAdmin({ search: first.name });
    expect(search.items.map((m) => m.id)).toContain(first.id);

    const paged = await listMessagesAdmin({ page: 1, pageSize: 1 });
    expect(paged.items).toHaveLength(1);
    expect(paged.total).toBeGreaterThanOrEqual(2);
  });

  it("counts totals and unread for dashboard stats", async () => {
    await createContactMessage(messageInput());
    const stats = await getMessageStats();

    expect(stats.total).toBeGreaterThan(0);
    expect(stats.unread).toBeGreaterThan(0);
  });
});
