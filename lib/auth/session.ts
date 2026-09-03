import "server-only";

import { cookies } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db/prisma";
import type { Admin } from "@/lib/generated/prisma/client";

const SESSION_COOKIE = "cafe_session";
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const SLIDING_REFRESH_MS = 6 * 60 * 60 * 1000; // refresh lastUsedAt after 6h

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(adminId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db.session.create({
    data: {
      tokenHash: hashToken(token),
      adminId,
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export interface SessionAdmin {
  id: string;
  email: string;
  name: string;
  role: Admin["role"];
  isActive: boolean;
}

export async function getSession(): Promise<SessionAdmin | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const tokenHash = hashToken(token);
  const session = await db.session.findUnique({
    where: { tokenHash },
    include: { admin: { select: { id: true, email: true, name: true, role: true, isActive: true } } },
  });

  if (!session || session.expiresAt < new Date()) {
    if (session) {
      await db.session.delete({ where: { id: session.id } }).catch(() => undefined);
    }
    return null;
  }

  if (!session.admin.isActive) return null;

  // Sliding expiry: refresh lastUsedAt periodically without a write on every request.
  if (Date.now() - session.lastUsedAt.getTime() > SLIDING_REFRESH_MS) {
    await db.session
      .update({
        where: { id: session.id },
        data: { lastUsedAt: new Date() },
      })
      .catch(() => undefined);
  }

  return {
    id: session.admin.id,
    email: session.admin.email,
    name: session.admin.name,
    role: session.admin.role,
    isActive: session.admin.isActive,
  };
}

export async function deleteSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.session
      .deleteMany({ where: { tokenHash: hashToken(token) } })
      .catch(() => undefined);
  }
  cookieStore.delete(SESSION_COOKIE);
}

export async function revokeAllSessions(adminId: string) {
  await db.session.deleteMany({ where: { adminId } });
}