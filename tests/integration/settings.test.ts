import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  unstable_cache: (fn: unknown) => fn,
}));

import { db } from "@/lib/db/prisma";
import {
  getSettings,
  getSettingsFresh,
  normalizeSettings,
  updateSettings,
} from "@/lib/services/settings";
import { makeAdmin, truncateTables, uniqueSuffix } from "../helpers/db";

let testAdminId: string;

beforeAll(async () => {
  await truncateTables("ActivityLog", "Setting", "Admin");
  const admin = await makeAdmin();
  testAdminId = admin.id;
});

afterAll(async () => {
  await truncateTables("ActivityLog", "Setting", "Admin");
});

describe("normalizeSettings", () => {
  it("returns defaults when no rows are provided", () => {
    const settings = normalizeSettings([]);
    expect(settings.cafeName).toBe("Spice & Saffron");
    expect(settings.phone).toBeTruthy();
    expect(settings.email).toBeTruthy();
  });

  it("overrides defaults with provided rows", () => {
    const settings = normalizeSettings([
      { key: "cafeName", value: "Custom Cafe" },
      { key: "phone", value: "+91 12345 67890" },
    ]);
    expect(settings.cafeName).toBe("Custom Cafe");
    expect(settings.phone).toBe("+91 12345 67890");
    // Other defaults remain
    expect(settings.email).toBeTruthy();
  });

  it("ignores unknown keys", () => {
    const settings = normalizeSettings([
      { key: "cafeName", value: "Test" },
      { key: "unknownKey", value: "should be ignored" },
    ]);
    expect(settings.cafeName).toBe("Test");
    expect((settings as Record<string, unknown>).unknownKey).toBeUndefined();
  });
});

describe("settings service", () => {
  it("persists and retrieves settings", async () => {
    const suffix = uniqueSuffix();
    await updateSettings({
      cafeName: `Test Cafe ${suffix}`,
      tagline: "Testing settings",
      phone: "+91 99999 00000",
      email: `test-${suffix}@example.com`,
      address: "123 Test Street",
      mapsLink: "https://maps.example.com",
      openingHours: JSON.stringify({ monday: "9-5" }),
      instagram: "https://instagram.com/test",
      facebook: "https://facebook.com/test",
      whatsapp: "+919999900000",
      reservationLink: "",
    });

    const fresh = await getSettingsFresh();
    expect(fresh.cafeName).toBe(`Test Cafe ${suffix}`);
    expect(fresh.phone).toBe("+91 99999 00000");
    expect(fresh.email).toBe(`test-${suffix}@example.com`);
  });

  it("creates audit log entries when updating settings", async () => {
    const suffix = uniqueSuffix();
    await updateSettings(
      {
        cafeName: `Audit Test ${suffix}`,
        tagline: "",
        phone: "",
        email: `audit-${suffix}@example.com`,
        address: "",
        mapsLink: "",
        openingHours: "",
        instagram: "",
        facebook: "",
        whatsapp: "",
        reservationLink: "",
      },
      testAdminId
    );

    const logs = await db.activityLog.findMany({
      where: { action: "SETTINGS_CHANGED" },
      orderBy: { createdAt: "desc" },
      take: 1,
    });
    expect(logs).toHaveLength(1);
    expect(logs[0].actorId).toBe(testAdminId);
    expect(logs[0].entityType).toBe("SETTING");
  });

  it("getSettings returns cached result", async () => {
    const suffix = uniqueSuffix();
    await updateSettings({
      cafeName: `Cached Cafe ${suffix}`,
      tagline: "",
      phone: "",
      email: `cache-${suffix}@example.com`,
      address: "",
      mapsLink: "",
      openingHours: "",
      instagram: "",
      facebook: "",
      whatsapp: "",
      reservationLink: "",
    });

    const settings = await getSettings();
    expect(settings.cafeName).toBe(`Cached Cafe ${suffix}`);
  });
});
