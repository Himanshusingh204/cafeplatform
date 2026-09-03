import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@/lib/db/prisma";
import { logAction } from "@/lib/services/audit";
import { makeAdmin, truncateTables } from "../helpers/db";

beforeAll(async () => {
  await truncateTables("ActivityLog", "Admin");
});

afterAll(async () => {
  await truncateTables("ActivityLog", "Admin");
});

describe("audit log service", () => {
  it("creates an activity log entry with all fields", async () => {
    const admin = await makeAdmin();
    await logAction({
      actorId: admin.id,
      action: "CREATE",
      entityType: "DISH",
      entityId: "dish-456",
      metadata: { name: "Butter Chicken", price: 349 },
    });

    const log = await db.activityLog.findFirst({
      where: { entityType: "DISH", entityId: "dish-456" },
    });

    expect(log).toBeTruthy();
    expect(log!.actorId).toBe(admin.id);
    expect(log!.action).toBe("CREATE");
    expect(log!.metadata).toEqual({ name: "Butter Chicken", price: 349 });
  });

  it("handles null actorId and entityId", async () => {
    await logAction({
      actorId: null,
      action: "SETTINGS_CHANGED",
      entityType: "SETTING",
      entityId: null,
    });

    const log = await db.activityLog.findFirst({
      where: { entityType: "SETTING", action: "SETTINGS_CHANGED" },
    });

    expect(log).toBeTruthy();
    expect(log!.actorId).toBeNull();
    expect(log!.entityId).toBeNull();
  });

  it("handles missing optional metadata", async () => {
    await logAction({
      action: "DELETE",
      entityType: "CATEGORY",
      entityId: "cat-789",
    });

    const log = await db.activityLog.findFirst({
      where: { entityType: "CATEGORY", entityId: "cat-789" },
    });

    expect(log).toBeTruthy();
    expect(log!.metadata).toBeNull();
  });

  it("creates entries for various action types", async () => {
    const actions = ["CREATE", "UPDATE", "DELETE", "FEATURE", "UNPUBLISH", "MESSAGE_STATUS_CHANGED", "SETTINGS_CHANGED"] as const;

    for (const action of actions) {
      await logAction({
        action,
        entityType: "TEST",
        entityId: `test-${action}`,
      });
    }

    const logs = await db.activityLog.findMany({
      where: { entityType: "TEST" },
    });

    expect(logs).toHaveLength(actions.length);
  });
});
