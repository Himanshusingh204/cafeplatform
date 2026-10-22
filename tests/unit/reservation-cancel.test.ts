import { beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.hoisted(() => vi.fn());
const updateMany = vi.hoisted(() => vi.fn());
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/prisma", () => ({
  db: { reservation: { findUnique, updateMany }, activityLog: { create: vi.fn() } },
}));

import { cancelReservationForCustomer } from "@/lib/services/reservations";

const now = new Date("2026-06-10T10:00:00Z");
const row = (over: Record<string, unknown> = {}) => ({
  id: "r1",
  email: "Guest@Example.com",
  status: "PENDING",
  date: new Date("2026-06-12T00:00:00Z"),
  ...over,
});

beforeEach(() => {
  findUnique.mockReset();
  updateMany.mockReset();
});

describe("cancelReservationForCustomer", () => {
  it("cancels with a matching email", async () => {
    findUnique.mockResolvedValue(row());
    updateMany.mockResolvedValue({ count: 1 });
    expect(await cancelReservationForCustomer("res-abc12", "guest@example.com", now)).toBe("cancelled");
    expect(updateMany.mock.calls[0][0].where.status).toEqual({ in: ["PENDING", "CONFIRMED"] });
  });

  it("treats a wrong email like a missing booking", async () => {
    findUnique.mockResolvedValue(row());
    expect(await cancelReservationForCustomer("RES-ABC12", "other@example.com", now)).toBe("not_found");
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("is idempotent for an already cancelled booking", async () => {
    findUnique.mockResolvedValue(row({ status: "CANCELLED" }));
    expect(await cancelReservationForCustomer("RES-ABC12", "guest@example.com", now)).toBe("already_cancelled");
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("refuses seated or past bookings", async () => {
    findUnique.mockResolvedValue(row({ status: "SEATED" }));
    updateMany.mockResolvedValue({ count: 0 });
    expect(await cancelReservationForCustomer("RES-ABC12", "guest@example.com", now)).toBe("not_cancellable");
  });
});
