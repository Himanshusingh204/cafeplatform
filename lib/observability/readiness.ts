import "server-only";

import { db } from "@/lib/db/prisma";

export const OUTBOX_BACKLOG_AGE_MS = 15 * 60_000;
const CHECK_TIMEOUT_MS = 2000;

function withTimeout<T>(p: PromiseLike<T>, ms = CHECK_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

type CheckState = "ok" | "fail" | "skipped";

export interface ReadinessResult {
  httpStatus: 200 | 503;
  body: { status: "ok" | "degraded" | "unavailable"; checks: Record<string, CheckState> };
}

export async function checkReadiness(): Promise<ReadinessResult> {
  const checks: Record<string, CheckState> = { database: "fail", redis: "skipped", outbox: "skipped" };

  try {
    await withTimeout(db.$queryRaw`SELECT 1`);
    checks.database = "ok";
  } catch {
    return { httpStatus: 503, body: { status: "unavailable", checks } };
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    try {
      const res = await withTimeout(
        fetch(url, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(["PING"]),
          cache: "no-store",
        })
      );
      checks.redis = res.ok ? "ok" : "fail";
    } catch {
      checks.redis = "fail";
    }
  }

  try {
    const cutoff = new Date(Date.now() - OUTBOX_BACKLOG_AGE_MS);
    const stale = await withTimeout(
      db.outboxEvent.count({ where: { status: "PENDING", createdAt: { lt: cutoff } } })
    );
    checks.outbox = stale > 0 ? "fail" : "ok";
  } catch {
    checks.outbox = "fail";
  }

  const degraded = checks.redis === "fail" || checks.outbox === "fail";
  return { httpStatus: 200, body: { status: degraded ? "degraded" : "ok", checks } };
}

/** Cheap outbox gauges: one grouped count plus one min() over PENDING (index-backed). */
export async function outboxGauges() {
  const [grouped, oldest] = await Promise.all([
    db.outboxEvent.groupBy({ by: ["status"], _count: { _all: true } }),
    db.outboxEvent.aggregate({ where: { status: "PENDING" }, _min: { createdAt: true } }),
  ]);
  const count = (s: string) => grouped.find((g) => g.status === s)?._count._all ?? 0;
  const oldestAt = oldest._min.createdAt;
  return [
    { name: "outbox_pending", help: "PENDING outbox events", value: count("PENDING") },
    {
      name: "outbox_oldest_pending_age_seconds",
      help: "Age of the oldest PENDING outbox event",
      value: oldestAt ? Math.max(0, Math.round((Date.now() - oldestAt.getTime()) / 1000)) : 0,
    },
    { name: "outbox_dead", help: "DEAD outbox events", value: count("DEAD") },
  ];
}
