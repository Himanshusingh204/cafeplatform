import { beforeEach, describe, expect, it, vi } from "vitest";

const { ordersFindMany, reservationsFindMany, verifyS2SRequest } = vi.hoisted(() => ({
  ordersFindMany: vi.fn(),
  reservationsFindMany: vi.fn(),
  verifyS2SRequest: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  db: {
    order: { findMany: ordersFindMany },
    reservation: { findMany: reservationsFindMany },
  },
}));

vi.mock("@/lib/auth/s2s", () => ({ verifyS2SRequest }));

import { GET as getOrders } from "@/app/api/v1/orders/route";
import { GET as getReservations } from "@/app/api/v1/reservations/route";

const TENANT_ID = "11111111-1111-1111-1111-111111111111";

function authenticated() {
  verifyS2SRequest.mockResolvedValue({
    success: true,
    context: { id: "key-1", tenantId: TENANT_ID, scopes: ["orders:read", "reservations:read"] },
  });
}

function unauthenticated() {
  verifyS2SRequest.mockResolvedValue({
    success: false,
    status: 401,
    error: "Missing Authorization header with Bearer API Key",
  });
}

function url(path: string, query: Record<string, string> = {}): Request {
  const params = new URLSearchParams(query).toString();
  return new Request(`http://localhost:3000${path}${params ? `?${params}` : ""}`);
}

describe("GET /api/v1/orders query validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ordersFindMany.mockResolvedValue([]);
  });

  it("returns 401 without credentials", async () => {
    unauthenticated();
    const res = await getOrders(url("/api/v1/orders"));
    expect(res.status).toBe(401);
    expect(ordersFindMany).not.toHaveBeenCalled();
  });

  it("rejects an unknown status with 400 instead of a Prisma 500", async () => {
    authenticated();
    const res = await getOrders(url("/api/v1/orders", { status: "NOT_A_STATUS" }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; allowed: string[] };
    expect(body.error).toContain("Invalid status");
    expect(body.allowed).toContain("PREPARING");
    expect(ordersFindMany).not.toHaveBeenCalled();
  });

  it("rejects a non-numeric limit with 400", async () => {
    authenticated();
    const res = await getOrders(url("/api/v1/orders", { limit: "abc" }));
    expect(res.status).toBe(400);
    expect(ordersFindMany).not.toHaveBeenCalled();
  });

  it("defaults to 50 and clamps out-of-range limits", async () => {
    authenticated();
    await getOrders(url("/api/v1/orders"));
    expect(ordersFindMany).toHaveBeenLastCalledWith(expect.objectContaining({ take: 50 }));

    await getOrders(url("/api/v1/orders", { limit: "1000" }));
    expect(ordersFindMany).toHaveBeenLastCalledWith(expect.objectContaining({ take: 100 }));

    await getOrders(url("/api/v1/orders", { limit: "-5" }));
    expect(ordersFindMany).toHaveBeenLastCalledWith(expect.objectContaining({ take: 1 }));
  });

  it("scopes strictly to the authenticated tenant (no tenant-less rows)", async () => {
    authenticated();
    const res = await getOrders(url("/api/v1/orders", { status: "PENDING" }));
    expect(res.status).toBe(200);

    const args = ordersFindMany.mock.calls.at(-1)?.[0] as {
      where: Record<string, unknown>;
    };
    expect(args.where).toEqual({ tenantId: TENANT_ID, orderStatus: "PENDING" });
    expect(args.where).not.toHaveProperty("OR");
  });
});

describe("GET /api/v1/reservations query validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reservationsFindMany.mockResolvedValue([]);
  });

  it("returns 401 without credentials", async () => {
    unauthenticated();
    const res = await getReservations(url("/api/v1/reservations"));
    expect(res.status).toBe(401);
    expect(reservationsFindMany).not.toHaveBeenCalled();
  });

  it("rejects malformed and impossible dates with 400", async () => {
    authenticated();
    for (const date of ["yesterday", "2026-13-01", "2026-02-31"]) {
      const res = await getReservations(url("/api/v1/reservations", { date }));
      expect(res.status, date).toBe(400);
    }
    expect(reservationsFindMany).not.toHaveBeenCalled();
  });

  it("caps the result set and scopes to the authenticated tenant", async () => {
    authenticated();
    const res = await getReservations(url("/api/v1/reservations", { date: "2026-10-21" }));
    expect(res.status).toBe(200);

    const args = reservationsFindMany.mock.calls.at(-1)?.[0] as {
      where: Record<string, unknown>;
      take: number;
    };
    expect(args.take).toBe(500);
    expect(args.where).toEqual({
      tenantId: TENANT_ID,
      date: new Date("2026-10-21T00:00:00.000Z"),
    });
    expect(args.where).not.toHaveProperty("OR");
  });

  it("defaults to today rather than dumping every reservation", async () => {
    authenticated();
    await getReservations(url("/api/v1/reservations"));
    const args = reservationsFindMany.mock.calls.at(-1)?.[0] as { take: number };
    expect(args.take).toBe(500);
    expect(reservationsFindMany).toHaveBeenCalledTimes(1);
  });
});
