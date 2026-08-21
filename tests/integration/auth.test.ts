import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const cookieMocks = vi.hoisted(() => {
  const store = new Map<string, string>();
  return {
    store,
    cookies: async () => ({
      get: (name: string) =>
        store.has(name) ? { name, value: store.get(name) as string } : undefined,
      set: (name: string, value: string) => {
        store.set(name, value);
      },
      delete: (name: string) => {
        store.delete(name);
      },
    }),
  };
});

vi.mock("next/headers", () => ({ cookies: cookieMocks.cookies }));

import { db } from "@/lib/db/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth/passwords";
import {
  createSession,
  deleteSession,
  getSession,
  hashToken,
  revokeAllSessions,
} from "@/lib/auth/session";
import { makeAdmin, truncateTables } from "../helpers/db";

beforeEach(() => {
  cookieMocks.store.clear();
});

describe("passwords", () => {
  it("verifies the correct password against an Argon2id hash", async () => {
    const hash = await hashPassword("CorrectHorse1!");
    expect(hash.startsWith("$argon2id$")).toBe(true);
    expect(await verifyPassword(hash, "CorrectHorse1!")).toBe(true);
  });

  it("rejects a wrong password and a corrupt hash", async () => {
    const hash = await hashPassword("CorrectHorse1!");
    expect(await verifyPassword(hash, "WrongPassword1!")).toBe(false);
    expect(await verifyPassword("not-a-hash", "CorrectHorse1!")).toBe(false);
  });

  it("produces a unique salt per hash", async () => {
    const [a, b] = await Promise.all([hashPassword("SamePassword1!"), hashPassword("SamePassword1!")]);
    expect(a).not.toBe(b);
  });
});

describe("sessions", () => {
  let adminId: string;

  beforeAll(async () => {
    await truncateTables("Session", "Admin");
    const admin = await makeAdmin();
    adminId = admin.id;
  });

  afterAll(async () => {
    await truncateTables("Session", "Admin");
  });

  beforeEach(async () => {
    cookieMocks.store.clear();
    await truncateTables("Session");
  });

  it("stores only a hash of the token and sets an HttpOnly-style cookie value", async () => {
    await createSession(adminId);

    const rawToken = cookieMocks.store.get("cafe_session");
    expect(rawToken).toBeTruthy();

    const rows = await db.session.findMany({ where: { adminId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).toBe(hashToken(rawToken as string));
    expect(rows[0].tokenHash).not.toBe(rawToken);
  });

  it("resolves the admin for a valid session token", async () => {
    await createSession(adminId);
    const session = await getSession();
    expect(session).not.toBeNull();
    expect(session?.id).toBe(adminId);
    expect(session?.email).toContain("@test.example");
  });

  it("returns null when no cookie is present", async () => {
    expect(await getSession()).toBeNull();
  });

  it("returns null and deletes an expired session", async () => {
    await createSession(adminId);
    const row = await db.session.findFirstOrThrow({ where: { adminId } });
    await db.session.update({
      where: { id: row.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    expect(await getSession()).toBeNull();
    expect(await db.session.findUnique({ where: { id: row.id } })).toBeNull();
  });

  it("returns null for a session whose admin was deactivated", async () => {
    const admin = await makeAdmin({ isActive: false });
    await createSession(admin.id);
    expect(await getSession()).toBeNull();
  });

  it("returns null for a tampered token that matches no session", async () => {
    await createSession(adminId);
    cookieMocks.store.set("cafe_session", "forged-token-value");
    expect(await getSession()).toBeNull();
  });

  it("removes the server-side record on logout", async () => {
    await createSession(adminId);
    await deleteSession();

    expect(cookieMocks.store.has("cafe_session")).toBe(false);
    expect(await db.session.count({ where: { adminId } })).toBe(0);
  });

  it("revokes every session for an admin at once", async () => {
    await createSession(adminId);
    cookieMocks.store.clear();
    await createSession(adminId);
    expect(await db.session.count({ where: { adminId } })).toBe(2);

    await revokeAllSessions(adminId);
    expect(await db.session.count({ where: { adminId } })).toBe(0);
  });
});
