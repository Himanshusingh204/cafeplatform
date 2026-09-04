import Link from "next/link";
import {
  ArrowRight,
  ChefHat,
  FolderOpen,
  Mail,
  Star,
  Plus,
  Settings,
  Flame,
  Leaf,
  Clock,
  ExternalLink,
  Calendar,
  ShoppingBag,
  Tag,
} from "lucide-react";
import {
  getDashboardStats,
  getRecentActivity,
  getRecentDishes,
  getCategoryBreakdown,
  getRecentMessages,
} from "@/lib/services/dashboard";
import { getReservationStats } from "@/lib/services/reservations";
import { getOrderStats } from "@/lib/services/orders";
import { getSettings } from "@/lib/services/settings";
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
  MESSAGE_STATUS_CHANGED: "updated message to",
  RESERVATION_STATUS_CHANGED: "updated booking to",
  ORDER_STATUS_CHANGED: "updated order to",
  REVIEW_MODERATED: "moderated review for",
};

export default async function AdminDashboardPage() {
  const admin = await requirePermission(permissions.VIEW_MENU);

  const [stats, activity, recentDishes, categories, recentMessages, settings, resStats, orderStats] =
    await Promise.all([
      getDashboardStats(),
      getRecentActivity(5),
      getRecentDishes(5),
      getCategoryBreakdown(),
      getRecentMessages(4),
      getSettings(),
      getReservationStats(),
      getOrderStats(),
    ]);

  let hoursToday = "";
  try {
    const hours = JSON.parse(settings.openingHours || "{}") as Record<string, string>;
    const day = new Date().toLocaleDateString("en-IN", { weekday: "long" }).toLowerCase();
    hoursToday = hours[day] ?? "";
  } catch {
    hoursToday = "";
  }

  const vegPercentage = stats.totalDishes > 0
    ? Math.round((stats.vegetarianCount / stats.totalDishes) * 100)
    : 0;

  const cards = [
    {
      label: "Live Kitchen Queue",
      value: orderStats.activeOrders,
      subtext: `${orderStats.completedToday} fulfilled today`,
      badge: orderStats.activeOrders > 0 ? "ACTION REQ" : "ALL CLEAR",
      badgeColor: orderStats.activeOrders > 0 ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" : "bg-success/15 text-success",
      icon: ShoppingBag,
      href: "/admin/orders",
      color: "text-amber-500",
    },
    {
      label: "Table Bookings",
      value: resStats.todayCount,
      subtext: resStats.pendingCount > 0 ? `${resStats.pendingCount} pending confirmation` : "Today's dining guests",
      badge: resStats.pendingCount > 0 ? `${resStats.pendingCount} PENDING` : "ACTIVE",
      badgeColor: resStats.pendingCount > 0 ? "bg-blue-500/15 text-blue-600 dark:text-blue-400" : "bg-muted text-muted-foreground",
      icon: Calendar,
      href: "/admin/reservations",
      color: "text-blue-500",
    },
    {
      label: "Menu Items",
      value: stats.totalDishes,
      subtext: `${stats.availableDishes} live · ${stats.hiddenDishes} hidden`,
      icon: ChefHat,
      href: "/admin/dishes",
      color: "text-primary",
    },
    {
      label: "Promos & Coupons",
      value: "Manage",
      subtext: "Discounts & promotional codes",
      icon: Tag,
      href: "/admin/coupons",
      color: "text-emerald-500",
    },
    {
      label: "Customer Inquiries",
      value: stats.totalMessages,
      subtext: stats.newMessages > 0 ? `${stats.newMessages} unread messages` : "All messages reviewed",
      badge: stats.newMessages > 0 ? `${stats.newMessages} NEW` : undefined,
      badgeColor: "bg-primary/15 text-primary",
      icon: Mail,
      href: "/admin/messages",
      color: "text-primary",
    },
    {
      label: "Sections & Categories",
      value: stats.activeCategories,
      subtext: "Organized menu courses",
      icon: FolderOpen,
      href: "/admin/categories",
      color: "text-indigo-500",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Executive Header Banner */}
      <div className="rounded-2xl border border-border bg-linear-to-r from-card via-card to-muted/40 p-6 md:p-8 shadow-card">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="heading-display text-2xl md:text-3xl font-bold text-foreground">
                Executive Operations Control
              </h1>
              <span className="rounded-full bg-primary/10 border border-primary/20 px-3 py-0.5 text-xs font-semibold uppercase tracking-wider text-primary">
                {admin.role.replace("_", " ")}
              </span>
            </div>
            <p className="text-xs md:text-sm text-muted-foreground">
              Real-time dispatch, table reservations, and menu management for <strong className="text-foreground">{settings.cafeName}</strong>.
            </p>
          </div>

          {/* Quick Real-Time Status Pills */}
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-card/80 px-3.5 py-2 text-muted-foreground shadow-xs">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              <span className="font-medium text-foreground">PostgreSQL & Realtime Online</span>
            </div>
            {hoursToday ? (
              <div className="flex items-center gap-1.5 rounded-xl border border-border bg-card/80 px-3.5 py-2 text-muted-foreground shadow-xs">
                <Clock className="h-3.5 w-3.5 text-primary" />
                <span>Today: <strong className="text-foreground">{hoursToday}</strong></span>
              </div>
            ) : null}
            <Link
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 font-medium text-foreground hover:bg-muted transition-colors shadow-xs"
            >
              <span>Customer Site</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* Action Options Hub for Admin */}
        <div className="mt-6 border-t border-border/70 pt-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Quick Action Options Hub
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2.5">
            <Link
              href="/admin/dishes"
              className="flex items-center gap-2 rounded-xl bg-primary px-3.5 py-2.5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-all hover:scale-[1.02]"
            >
              <Plus className="h-4 w-4 shrink-0" />
              <span className="truncate">Add Dish</span>
            </Link>
            <Link
              href="/admin/kds"
              className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-all hover:scale-[1.02]"
            >
              <Flame className="h-4 w-4 shrink-0" />
              <span className="truncate">Kitchen KDS</span>
            </Link>
            <Link
              href="/admin/coupons"
              className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-all hover:scale-[1.02]"
            >
              <Tag className="h-4 w-4 shrink-0" />
              <span className="truncate">Promos / Codes</span>
            </Link>
            <Link
              href="/admin/reservations"
              className="flex items-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 px-3.5 py-2.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-all hover:scale-[1.02]"
            >
              <Calendar className="h-4 w-4 shrink-0" />
              <span className="truncate">Bookings</span>
            </Link>
            <Link
              href="/admin/orders"
              className="flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
            >
              <ShoppingBag className="h-4 w-4 shrink-0 text-amber-500" />
              <span className="truncate">Takeaways</span>
            </Link>
            <Link
              href="/admin/reviews"
              className="flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
            >
              <Star className="h-4 w-4 shrink-0 text-amber-500" />
              <span className="truncate">Reviews</span>
            </Link>
            <Link
              href="/admin/settings"
              className="flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
            >
              <Settings className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">Settings</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Key Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="group relative flex flex-col justify-between rounded-xl border border-border bg-card p-4 md:p-5 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card-hover"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground truncate">{card.label}</span>
                <div className="rounded-lg bg-muted/70 p-2 transition-colors group-hover:bg-primary/10">
                  <card.icon className={`h-4 w-4 ${card.color}`} aria-hidden="true" />
                </div>
              </div>
              <div className="mt-2.5 flex items-baseline gap-2">
                <p className="heading-display text-2xl font-bold text-foreground">{card.value}</p>
                {card.badge ? (
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${card.badgeColor || "bg-primary/15 text-primary"}`}>
                    {card.badge}
                  </span>
                ) : null}
              </div>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground leading-tight">{card.subtext}</p>
          </Link>
        ))}
      </div>

      {/* Two Column Layout */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column (7 cols): Customer Messages & Recent Dishes */}
        <div className="space-y-6 lg:col-span-7">
          {/* Customer Messages Snapshot */}
          <section
            aria-labelledby="recent-messages-heading"
            className="rounded-xl border border-border bg-card shadow-card"
          >
            <header className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                <h2 id="recent-messages-heading" className="font-medium">
                  Recent Inquiries
                </h2>
                {stats.newMessages > 0 ? (
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
                    {stats.newMessages} new
                  </span>
                ) : null}
              </div>
              <Link
                href="/admin/messages"
                className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                View inbox <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </Link>
            </header>

            {recentMessages.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                No customer inquiries received yet.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {recentMessages.map((msg) => (
                  <li key={msg.id} className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-muted/30">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-foreground">{msg.name}</span>
                        <span
                          className={
                            msg.status === "NEW"
                              ? "rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400"
                              : msg.status === "REPLIED"
                              ? "rounded bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400"
                              : "rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                          }
                        >
                          {msg.status}
                        </span>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {msg.subject || "No subject"} · {msg.email}
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {new Date(msg.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Recently Added / Updated Dishes */}
          <section
            aria-labelledby="recent-dishes-heading"
            className="rounded-xl border border-border bg-card shadow-card"
          >
            <header className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2">
                <ChefHat className="h-4 w-4 text-primary" />
                <h2 id="recent-dishes-heading" className="font-medium">
                  Recent Dishes
                </h2>
              </div>
              <Link
                href="/admin/dishes"
                className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                Manage all <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </Link>
            </header>

            {recentDishes.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                No dishes in menu yet.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {recentDishes.map((dish) => (
                  <li key={dish.id} className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-muted/30">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-foreground">{dish.name}</span>
                        {dish.isFeatured ? (
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground">{dish.category?.name ?? "Menu item"}</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold">{formatPrice(dish.price)}</span>
                      <span
                        className={
                          dish.isAvailable
                            ? "rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success"
                            : "rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                        }
                      >
                        {dish.isAvailable ? "Available" : "Hidden"}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Right Column (5 cols): Menu Breakdown, Categories & Activity */}
        <div className="space-y-6 lg:col-span-5">
          {/* Dietary & Menu Health Breakdown */}
          <section className="rounded-xl border border-border bg-card p-5 shadow-card">
            <h2 className="font-medium text-foreground">Menu Composition</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Dietary balance and specials overview
            </p>

            <div className="mt-4 space-y-4">
              {/* Veg Ratio Bar */}
              <div>
                <div className="flex justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-medium text-foreground">
                    <Leaf className="h-3.5 w-3.5 text-success" />
                    Vegetarian & Vegan
                  </span>
                  <span className="text-muted-foreground">
                    {stats.vegetarianCount} / {stats.totalDishes} ({vegPercentage}%)
                  </span>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-success transition-all duration-500"
                    style={{ width: `${vegPercentage}%` }}
                  />
                </div>
              </div>

              {/* Badges Grid */}
              <div className="grid grid-cols-3 gap-2 pt-2">
                <div className="rounded-lg border border-border bg-muted/40 p-2.5 text-center">
                  <p className="text-[11px] text-muted-foreground">Vegan</p>
                  <p className="mt-0.5 text-base font-bold text-foreground">{stats.veganCount}</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/40 p-2.5 text-center">
                  <p className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
                    <Flame className="h-3 w-3 text-primary" /> Spicy
                  </p>
                  <p className="mt-0.5 text-base font-bold text-foreground">{stats.spicyCount}</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/40 p-2.5 text-center">
                  <p className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
                    <Star className="h-3 w-3 text-amber-500" /> Featured
                  </p>
                  <p className="mt-0.5 text-base font-bold text-foreground">{stats.featuredItems}</p>
                </div>
              </div>
            </div>
          </section>

          {/* Category Distribution */}
          <section className="rounded-xl border border-border bg-card p-5 shadow-card">
            <div className="flex items-center justify-between">
              <h2 className="font-medium text-foreground">Categories</h2>
              <Link href="/admin/categories" className="text-xs font-medium text-primary hover:underline">
                Manage
              </Link>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">Distribution across menu sections</p>

            <ul className="mt-4 divide-y divide-border">
              {categories.map((cat) => {
                const count = cat._count.dishes;
                const ratio = stats.totalDishes > 0 ? Math.round((count / stats.totalDishes) * 100) : 0;
                return (
                  <li key={cat.id} className="py-2.5 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground">{cat.name}</span>
                      <span className="text-muted-foreground">
                        {count} dishes ({ratio}%)
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary/70 transition-all duration-500"
                        style={{ width: `${ratio}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Recent Activity Log */}
          <section className="rounded-xl border border-border bg-card p-5 shadow-card">
            <div className="flex items-center justify-between">
              <h2 className="font-medium text-foreground">Activity Log</h2>
              <Link href="/admin/activity" className="text-xs font-medium text-primary hover:underline">
                Full log
              </Link>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">Recent staff and system actions</p>

            {activity.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">No recent activity.</p>
            ) : (
              <ul className="mt-3 divide-y divide-border">
                {activity.map((entry) => (
                  <li key={entry.id} className="py-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground">{entry.actor?.name ?? "Staff"}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(entry.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-muted-foreground">
                      {actionLabels[entry.action] ?? entry.action.toLowerCase()}{" "}
                      <span className="text-foreground">{entry.entityType.toLowerCase()}</span>
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
