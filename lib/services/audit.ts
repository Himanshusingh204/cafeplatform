import "server-only";

import { db } from "@/lib/db/prisma";
import type { ActivityAction } from "@/lib/generated/prisma/enums";

export async function logAction(input: {
  actorId?: string | null;
  action: ActivityAction;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  await db.activityLog.create({
    data: {
      actorId: input.actorId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      metadata: (input.metadata as object | null) ?? undefined,
    },
  });
}