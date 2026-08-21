import Link from "next/link";
import { ArrowRight, ChefHat, FolderOpen, Mail, Star } from "lucide-react";
import { getDashboardStats, getRecentActivity, getRecentDishes } from "@/lib/services/dashboard";
import { formatPrice } from "@/lib/utils/format";
import { requirePermission } from "@/lib/auth/guards";
import { permissions } from "@/config/roles";

export const dynamic = "force-dynamic";

const actionLabels: Record<string, string> = {
  LOGIN: "signed in",
  LOGOUT: "signed out",
  LOGIN_FAILED: "failed sign-in",
  CREATE: "created",
  UPDATE: "updated",
  DELETE: "deleted",
  PUBLISH: "made available",
  UNPUBLISH: "marked unavailable",
  FEATURE: "featured",
  SETTINGS_CHANGED: "changed settings for",
  MESSAGE_STATUS_CHANGED: "updated a message to",
};

export default async function AdminDashboardPage() {
  await requirePermission(permissions.VIEW_MENU);
  const [stats, activity, recentDishes] = await Promise.all([
    getDashboardStats(),
    getRecentActivity(),
    getRecentDishes(),
  ]);

  const cards = [
    { label: "Total dishes", value: stats.totalDishes, icon: ChefHat, href: "/admin/dishes" },
    { label: "Active categories", value: stats.activeCategories, icon: FolderOpen, href: "/admin/categories" },
    { label: "Featured items", value: stats.featuredItems, icon: Star, href: "/admin/dishes?featured=true" },
    { label: "New messages", value: stats.newMessages, icon: Mail, href: "/admin/messages" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="heading-display text-3xl">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A quick overview of the menu and inbox.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="group rounded-xl border border-border bg-card p-5 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card-hover"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{card.label}</span>
              <card.icon className="h-4 w-4 text-primary" aria-hidden="true" />
            </div>
            <p className="heading-display mt-2 text-3xl">{card.value}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="recent-dishes" className="rounded-xl border border-border bg-card shadow-card">
          <header className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 id="recent-dishes" className="font-medium">Recently added dishes</h2>
            <Link
              href="/admin/dishes"
              className="flex items-center gap-1 text-sm text-primary hover:underline"
            >
              Manage <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </header>
          {recentDishes.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">
              No dishes yet. Create your first dish.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {recentDishes.map((dish) => (
                <li key={dish.id} className="flex items-center justify-between px-5 py-3">
                  <span className="text-sm font-medium">{dish.name}</span>
                  <span className="flex items-center gap-3 text-sm text-muted-foreground">
                    {formatPrice(dish.price)}
                    <span
                      className={
                        dish.isAvailable
                          ? "rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success"
                          : "rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                      }
                    >
                      {dish.isAvailable ? "Available" : "Hidden"}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="recent-activity" className="rounded-xl border border-border bg-card shadow-card">
          <header className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 id="recent-activity" className="font-medium">Recent activity</h2>
            <Link
              href="/admin/activity"
              className="flex items-center gap-1 text-sm text-primary hover:underline"
            >
              Full log <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </header>
          {activity.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {activity.map((entry) => (
                <li key={entry.id} className="px-5 py-3 text-sm">
                  <span className="font-medium">{entry.actor?.name ?? "Someone"}</span>{" "}
                  <span className="text-muted-foreground">
                    {actionLabels[entry.action] ?? entry.action.toLowerCase()}{" "}
                    {entry.entityType.toLowerCase()}
                    {entry.entityId ? "" : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
