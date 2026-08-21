"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Archive, Check, MailOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { updateMessageStatusAction } from "@/app/admin/actions/messages";
import { formatDateTime } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

export interface AdminMessageRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  status: string;
  createdAt: string;
}

const STATUS_FILTERS = ["ALL", "NEW", "READ", "REPLIED", "ARCHIVED"] as const;

const statusBadge = (status: string) =>
  status === "NEW" ? "default" : status === "READ" ? "secondary" : status === "REPLIED" ? "success" : "outline";

export function MessageList({ messages }: { messages: AdminMessageRow[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentFilter = searchParams.get("status") ?? "ALL";
  const [expanded, setExpanded] = React.useState<string | null>(null);

  async function setStatus(id: string, status: string) {
    await updateMessageStatusAction(id, status);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="heading-display text-3xl">Messages</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enquiries submitted through the public contact form.
        </p>
      </div>

      <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((status) => (
          <a
            key={status}
            href={status === "ALL" ? "/admin/messages" : `/admin/messages?status=${status}`}
            aria-current={currentFilter === status ? "true" : undefined}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
              currentFilter === status
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            )}
          >
            {status.charAt(0) + status.slice(1).toLowerCase()}
          </a>
        ))}
      </nav>

      {messages.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
          <p className="heading-display text-xl">No messages here</p>
          <p className="mt-2 text-sm text-muted-foreground">New enquiries will appear in this inbox.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {messages.map((message) => (
            <li key={message.id} className="rounded-xl border border-border bg-card shadow-card">
              <button
                type="button"
                onClick={() => {
                  setExpanded(expanded === message.id ? null : message.id);
                  if (message.status === "NEW") void setStatus(message.id, "READ");
                }}
                aria-expanded={expanded === message.id}
                className="flex w-full flex-wrap items-center justify-between gap-3 px-5 py-4 text-left"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2.5 font-medium">
                    {message.subject}
                    <Badge variant={statusBadge(message.status)}>{message.status.toLowerCase()}</Badge>
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {message.name} · {message.email} · {formatDateTime(message.createdAt)}
                  </p>
                </div>
                <MailOpen className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </button>

              {expanded === message.id ? (
                <div className="border-t border-border px-5 py-4">
                  <p className="whitespace-pre-line text-sm leading-relaxed">{message.message}</p>
                  <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                    {message.phone ? (
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-muted-foreground">Phone</dt>
                        <dd>{message.phone}</dd>
                      </div>
                    ) : null}
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-muted-foreground">Reply to</dt>
                      <dd>
                        <a href={`mailto:${message.email}`} className="text-primary hover:underline">
                          {message.email}
                        </a>
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
                    {message.status !== "REPLIED" ? (
                      <button
                        type="button"
                        onClick={() => setStatus(message.id, "REPLIED")}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-sm font-medium transition-colors hover:bg-success/10 hover:text-success"
                      >
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        Mark replied
                      </button>
                    ) : null}
                    {message.status !== "ARCHIVED" ? (
                      <button
                        type="button"
                        onClick={() => setStatus(message.id, "ARCHIVED")}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                        Archive
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
