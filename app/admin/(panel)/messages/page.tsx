import type { Metadata } from "next";
import { Suspense } from "react";
import { MessageList } from "@/components/admin/message-list";
import { listMessagesAdmin } from "@/lib/services/messages";
import { requirePermission } from "@/lib/auth/guards";
import { permissions } from "@/config/roles";

export const metadata: Metadata = { title: "Messages" };

export const dynamic = "force-dynamic";

interface MessagesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminMessagesPage({ searchParams }: MessagesPageProps) {
  await requirePermission(permissions.VIEW_MESSAGES);
  const query = await searchParams;
  const status = typeof query.status === "string" ? query.status : undefined;

  const { items } = await listMessagesAdmin({
    status: status && ["NEW", "READ", "REPLIED", "ARCHIVED"].includes(status) ? status : undefined,
    page: 1,
    pageSize: 100,
  });

  return (
    <Suspense>
      <MessageList
        messages={items.map((message) => ({
          id: message.id,
          name: message.name,
          email: message.email,
          phone: message.phone,
          subject: message.subject,
          message: message.message,
          status: message.status,
          createdAt: message.createdAt.toISOString(),
        }))}
      />
    </Suspense>
  );
}
