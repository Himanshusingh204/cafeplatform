/**
 * Two-adapter parity smoke test.
 *
 * The same request is sent to the Next route handlers (called directly) and to
 * the Express app (bound to an ephemeral port), and the HTTP status plus the
 * SHAPE of the JSON body are compared. Values that legitimately differ between
 * two calls (ids, timestamps, order numbers) are reduced to their types.
 * This is a smoke test; the full contract suite is Phase 5.
 */
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApiKey } from "@/lib/auth/s2s";
import { db } from "@/lib/db/prisma";
import { GET as nextMenuGET } from "@/app/api/v1/menu/route";
import { POST as nextOrdersPOST } from "@/app/api/v1/orders/route";
import { app } from "@/server/app";
import { dishInput, makeCategory, truncateTables, uniqueSuffix } from "../helpers/db";

let server: Server;
let baseUrl: string;
let apiKey: string;
let readOnlyKey: string;
let tenantId: string;

/** Reduce a JSON value to its structure: keys sorted, leaves replaced by type names. */
function shapeOf(value: unknown): unknown {
  if (value === null) return "null";
  if (Array.isArray(value)) return value.length === 0 ? [] : [shapeOf(value[0])];
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((key) => [key, shapeOf((value as Record<string, unknown>)[key])])
    );
  }
  return typeof value;
}

async function callExpress(path: string, init: RequestInit) {
  const res = await fetch(`${baseUrl}${path}`, init);
  return { status: res.status, body: await res.json() };
}

async function callNext(handler: (r: Request) => Promise<Response>, path: string, init: RequestInit) {
  const res = await handler(new Request(`http://localhost${path}`, init));
  return { status: res.status, body: await res.json() };
}

function orderPayload(overrides: Record<string, unknown> = {}) {
  return {
    customerName: "Parity Tester",
    customerEmail: "parity@test.example",
    customerPhone: "9999999999",
    items: [{ dishName: "Ad hoc chai", quantity: 2, price: 50 }],
    paymentMethod: "PAY_AT_PICKUP",
    ...overrides,
  };
}

function post(key: string, body: unknown, extra: Record<string, string> = {}): RequestInit {
  return {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}`, ...extra },
    body: JSON.stringify(body),
  };
}

beforeAll(async () => {
  await truncateTables("Order", "OrderItem", "Dish", "Category");
  const tenant = await db.tenant.create({
    data: { slug: `parity-${uniqueSuffix()}`, name: "Parity Tenant" },
  });
  tenantId = tenant.id;
  apiKey = (
    await createApiKey({ tenantId, name: "parity", scopes: ["menu:read", "orders:write", "orders:read"] })
  ).apiKey;
  readOnlyKey = (await createApiKey({ tenantId, name: "parity-ro", scopes: ["menu:read"] })).apiKey;

  const category = await db.category.create({
    data: { tenantId, name: `Parity Cat ${uniqueSuffix()}`, slug: `parity-cat-${uniqueSuffix()}`, sortOrder: 0 },
  });
  await makeCategory();
  await db.dish.create({
    data: {
      ...dishInput(category.id, { name: `Parity Dish ${uniqueSuffix()}`, price: 120 }),
      tenantId,
      slug: `parity-dish-${uniqueSuffix()}`,
    },
  });

  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await truncateTables("Order", "OrderItem", "Dish", "Category");
  await db.tenant.delete({ where: { id: tenantId } }).catch(() => undefined);
});

describe("GET /api/v1/menu parity", () => {
  it("rejects a missing key identically", async () => {
    const n = await callNext(nextMenuGET, "/api/v1/menu", {});
    const e = await callExpress("/api/v1/menu", {});
    expect(e.status).toBe(n.status);
    expect(shapeOf(e.body)).toEqual(shapeOf(n.body));
  });

  it("returns the same status and body shape for a valid key", async () => {
    const init = { headers: { authorization: `Bearer ${apiKey}` } };
    const n = await callNext(nextMenuGET, "/api/v1/menu", init);
    const e = await callExpress("/api/v1/menu", init);
    expect(n.status).toBe(200);
    expect(e.status).toBe(200);
    expect(shapeOf(e.body)).toEqual(shapeOf(n.body));
    expect(e.body.data).toEqual(n.body.data);
    expect(typeof e.body.data[0].dishes[0].price).toBe("number");
  });
});

describe("POST /api/v1/orders parity", () => {
  it("enforces the orders:write scope identically", async () => {
    const n = await callNext(nextOrdersPOST, "/api/v1/orders", post(readOnlyKey, orderPayload()));
    const e = await callExpress("/api/v1/orders", post(readOnlyKey, orderPayload()));
    expect(e.status).toBe(n.status);
    expect(shapeOf(e.body)).toEqual(shapeOf(n.body));
  });

  it("maps validation failures to the same 422 envelope", async () => {
    const bad = orderPayload({ customerEmail: "not-an-email", items: [] });
    const n = await callNext(nextOrdersPOST, "/api/v1/orders", post(apiKey, bad));
    const e = await callExpress("/api/v1/orders", post(apiKey, bad));
    expect(n.status).toBe(422);
    expect(e.status).toBe(422);
    expect({ ...e.body, requestId: "x" }).toEqual({ ...n.body, requestId: "x" });
  });

  it("rejects malformed JSON with the same 400", async () => {
    const init: RequestInit = {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: "{not json",
    };
    const n = await callNext(nextOrdersPOST, "/api/v1/orders", init);
    const e = await callExpress("/api/v1/orders", init);
    expect(n.status).toBe(400);
    expect(e.status).toBe(400);
    expect({ ...e.body, requestId: "x" }).toEqual({ ...n.body, requestId: "x" });
  });

  it("creates an order with the same status and body shape", async () => {
    const n = await callNext(nextOrdersPOST, "/api/v1/orders", post(apiKey, orderPayload()));
    const e = await callExpress("/api/v1/orders", post(apiKey, orderPayload()));
    expect(n.status).toBe(201);
    expect(e.status).toBe(201);
    expect(shapeOf(e.body)).toEqual(shapeOf(n.body));
    expect(e.body.message).toBe(n.body.message);
    expect(Number(e.body.order.total)).toBe(Number(n.body.order.total));
  });

  it("replays an idempotent retry and rejects a mutated body in both runtimes", async () => {
    for (const [name, call] of [
      ["next", (init: RequestInit) => callNext(nextOrdersPOST, "/api/v1/orders", init)],
      ["express", (init: RequestInit) => callExpress("/api/v1/orders", init)],
    ] as const) {
      const key = `parity-${name}-${uniqueSuffix()}`;
      const first = await call(post(apiKey, orderPayload(), { "idempotency-key": key }));
      const replay = await call(post(apiKey, orderPayload(), { "idempotency-key": key }));
      const mutated = await call(
        post(apiKey, orderPayload({ tip: 10 }), { "idempotency-key": key })
      );
      expect(first.status).toBe(201);
      expect(replay.status).toBe(201);
      expect(replay.body.order.id).toBe(first.body.order.id);
      expect(mutated.status).toBe(409);
    }
  });
});
