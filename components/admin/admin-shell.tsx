"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  LogOut,
  Menu,
  X,
  UtensilsCrossed,
  FolderOpen,
  Image,
  Mail,
  Settings,
  Activity,
  Bell,
  ExternalLink,
  Calendar,
  ShoppingBag,
  Star,
  Tag,
  Flame,
  KeyRound,
  ShieldCheck,
} from "lucide-react";
import { adminNavigation } from "@/config/navigation";
import { cn } from "@/lib/utils/cn";
import { LogoMark, Wordmark } from "@/components/brand/logo";
import { useNotifications } from "@/hooks/use-notifications";

const navIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  "/admin": LayoutDashboard,
  "/admin/kds": Flame,
  "/admin/reservations": Calendar,
  "/admin/orders": ShoppingBag,
  "/admin/dishes": UtensilsCrossed,
  "/admin/categories": FolderOpen,
  "/admin/coupons": Tag,
  "/admin/reviews": Star,
  "/admin/gallery": Image,
  "/admin/developers": KeyRound,
  "/admin/messages": Mail,
  "/admin/settings": Settings,
  "/admin/activity": Activity,
};

export function AdminShell({
  admin,
  children,
}: {
  admin: { name: string; email: string; role: string };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const { lastNotification } = useNotifications();

  const closeMenu = () => setOpen(false);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/admin/login");
    router.refresh();
  }

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  const nav = (
    <nav aria-label="Admin navigation" className="flex flex-col gap-1">
      {adminNavigation.map((item) => {
        const Icon = navIcons[item.href] || ShieldCheck;
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={closeMenu}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-xs font-medium transition-all duration-200",
              active
                ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className={cn("h-4 w-4 shrink-0", active ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground")} />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen flex-col bg-background lg:flex-row">
      {/* Mobile Top Bar */}
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border bg-card/95 backdrop-blur px-4 lg:hidden">
        <Link href="/admin" className="flex items-center gap-2" aria-label="Admin home">
          <LogoMark />
          <Wordmark />
        </Link>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </header>

      {/* Mobile Drawer */}
      {open ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur lg:hidden animate-in fade-in duration-200">
          <div className="flex h-16 items-center justify-between border-b border-border px-4">
            <Link href="/admin" onClick={closeMenu} className="flex items-center gap-2">
              <LogoMark />
              <Wordmark />
            </Link>
            <button
              type="button"
              onClick={closeMenu}
              className="rounded-full p-2 text-muted-foreground hover:bg-muted"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {nav}
          </div>
          <div className="border-t border-border p-4 bg-muted/30">
            <div className="mb-3">
              <p className="text-sm font-semibold text-foreground">{admin.name}</p>
              <p className="text-xs text-muted-foreground capitalize">{admin.role.toLowerCase().replaceAll("_", " ")}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sign out
            </button>
          </div>
        </div>
      ) : null}

      {/* Desktop Sticky Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col justify-between border-r border-border bg-card lg:sticky lg:top-0 lg:flex lg:h-screen">
        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex h-16 items-center gap-2.5 px-6 border-b border-border">
            <Link href="/" className="flex items-center gap-2.5" aria-label="View public site">
              <LogoMark />
              <Wordmark />
            </Link>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
            {nav}
          </div>
        </div>

        {/* User Card at bottom of sidebar */}
        <div className="border-t border-border p-3 bg-muted/20">
          <div className="flex items-center justify-between rounded-xl bg-card border border-border/70 p-3 shadow-xs">
            <div className="min-w-0 flex-1 pr-2">
              <p className="truncate text-xs font-semibold text-foreground">{admin.name}</p>
              <p className="truncate text-[11px] text-muted-foreground capitalize">{admin.role.toLowerCase().replaceAll("_", " ")}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              title="Sign out"
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="hidden h-16 items-center justify-between border-b border-border bg-card px-8 lg:flex">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground shadow-xs"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              <span>View Customer Website</span>
            </Link>
            <Link
              href="/admin/kds"
              className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
            >
              <Flame className="h-3.5 w-3.5" />
              <span>Live Kitchen KDS</span>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/admin/messages"
              title="Customer Inquiries"
              className="relative flex items-center justify-center rounded-full border border-border p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <Bell className="h-4 w-4" />
              {lastNotification?.type === "new_message" && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground animate-pulse">
                  {lastNotification.count ?? 1}
                </span>
              )}
            </Link>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              <span>Logged in as <strong className="font-semibold text-foreground">{admin.email}</strong></span>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        </div>
        <main className="flex-1 px-4 py-8 md:px-8 max-w-7xl mx-auto w-full">{children}</main>
      </div>
    </div>
  );
}
