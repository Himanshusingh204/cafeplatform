import type { Metadata } from "next";
import { getRecentActivity } from "@/lib/services/dashboard";
import { requirePermission } from "@/lib/auth/guards";
import { permissions } from "@/config/roles";
import { formatDateTime } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Activity" };

export const dynamic = "force-dynamic";

const actionLabels: Record<string, string> = {
  LOGIN: "signed in",
  LOGOUT: "signed out",
  LOGIN_FAILED: "failed sign-in attempt",
  CREATE: "created",
  UPDATE: "updated",
  DELETE: "deleted",
  PUBLISH: "made available",
  UNPUBLISH: "marked unavailable",
  FEATURE: "featured",
  SETTINGS_CHANGED: "changed settings for",
  MESSAGE_STATUS_CHANGED: "updated a message to",
};

export default async function AdminActivityPage() {
  await requirePermission(permissions.VIEW_ACTIVITY);
  const entries = await getRecentActivity(100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="heading-display text-3xl">Activity log</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Audit trail of administrative actions. Newest first.
        </p>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
          <p className="heading-display text-xl">No activity recorded yet</p>
          <p className="mt-2 text-sm text-muted-foreground">Actions will appear here as staff work.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="px-5 py-3 font-medium">When</th>
                <th scope="col" className="px-5 py-3 font-medium">Who</th>
                <th scope="col" className="px-5 py-3 font-medium">Action</th>
                <th scope="col" className="px-5 py-3 font-medium">Entity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="whitespace-nowrap px-5 py-3 text-muted-foreground">
                    {formatDateTime(entry.createdAt)}
                  </td>
                  <td className="px-5 py-3 font-medium">{entry.actor?.name ?? "Unknown"}</td>
                  <td className="px-5 py-3">{actionLabels[entry.action] ?? entry.action.toLowerCase()}</td>
                  <td className="px-5 py-3 text-muted-foreground">{entry.entityType.toLowerCase()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
