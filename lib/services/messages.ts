import "server-only";

import { db } from "@/lib/db/prisma";
import { logAction } from "@/lib/services/audit";
import type { MessageStatus } from "@/lib/generated/prisma/enums";

export async function createContactMessage(input: {
  tenantId: string;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  ipHash?: string | null;
}) {
  return db.contactMessage.create({
    data: {
      tenantId: input.tenantId,
      name: input.name,
      email: input.email,
      phone: input.phone || null,
      subject: input.subject,
      message: input.message,
      ipHash: input.ipHash ?? null,
    },
  });
}

export async function listMessagesAdmin(input: {
  tenantId: string;
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  const where = {
    tenantId: input.tenantId,
    ...(input.status ? { status: input.status as MessageStatus } : {}),
    ...(input.search
      ? {
          OR: [
            { name: { contains: input.search, mode: "insensitive" as const } },
            { email: { contains: input.search, mode: "insensitive" as const } },
            { subject: { contains: input.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [total, items] = await Promise.all([
    db.contactMessage.count({ where }),
    db.contactMessage.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: ((input.page ?? 1) - 1) * (input.pageSize ?? 50),
      take: input.pageSize ?? 50,
    }),
  ]);

  return { total, items };
}

export async function updateMessageStatus(
  id: string,
  status: MessageStatus,
  tenantId: string,
  actorId?: string | null
) {
  const existing = await db.contactMessage.findFirst({ where: { id, tenantId } });
  if (!existing) throw new Error("NOT_FOUND");

  const message = await db.contactMessage.update({ where: { id }, data: { status } });

  await logAction({
    actorId,
    action: "MESSAGE_STATUS_CHANGED",
    entityType: "MESSAGE",
    entityId: id,
    metadata: { status },
  });

  return message;
}

export async function getMessageStats(tenantId: string) {
  const [total, unread] = await Promise.all([
    db.contactMessage.count({ where: { tenantId } }),
    db.contactMessage.count({ where: { tenantId, status: "NEW" } }),
  ]);
  return { total, unread };
}