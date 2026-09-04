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
} from "lucide-react";
import { adminNavigation } from "@/config/navigation";
import { cn } from "@/lib/utils/cn";
import { LogoMark, Wordmark } from "@/components/brand/logo";
import { useNotifications } from "@/hooks/use-notifications";

const navIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  "/admin": LayoutDashboard,
  "/admin/reservations": Calendar,
  "/admin/orders": ShoppingBag,
  "/admin/dishes": UtensilsCrossed,
  "/admin/categories": FolderOpen,
  "/admin/coupons": Tag,
  "/admin/reviews": Star,
  "/admin/gallery": Image,
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
        const Icon = navIcons[item.href];
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={closeMenu}
            aria-current={isActive(item.href) ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
              isActive(item.href)
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {Icon ? <Icon className="h-4 w-4" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen flex-col bg-background lg:flex-row">
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border bg-card px-4 lg:hidden">
        <Link href="/admin" className="flex items-center gap-2" aria-label="Admin home">
          <LogoMark />
          <Wordmark />
        </Link>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          className="rounded-full p-2 transition-colors hover:bg-muted"
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </header>

      {open ? (
        <div className="border-b border-border bg-card px-4 py-4 lg:hidden animate-in slide-in-from-top-2 duration-200 space-y-4">
          {nav}
          <div className="pt-3 border-t border-border">
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium transition-colors hover:bg-destructive hover:text-destructive-foreground"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sign out
            </button>
          </div>
        </div>
      ) : null}

      <aside className="hidden w-60 shrink-0 flex-col justify-between border-r border-border bg-card lg:sticky lg:top-0 lg:flex lg:h-screen lg:py-6">
        <div>
          <Link href="/" className="mb-8 flex items-center gap-2.5 px-5" aria-label="View public site">
            <LogoMark />
            <Wordmark />
          </Link>
          <div className="px-3">{nav}</div>
        </div>

        <div className="mx-3 rounded-xl bg-muted/70 p-4">
          <p className="truncate text-sm font-medium">{admin.name}</p>
          <p className="truncate text-xs text-muted-foreground">{admin.role.toLowerCase().replaceAll("_", " ")}</p>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium transition-colors hover:bg-destructive hover:text-destructive-foreground"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="hidden h-16 items-center justify-between border-b border-border bg-card px-8 lg:flex">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              <span>View Live Site</span>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Bell className="h-5 w-5 text-muted-foreground" />
                {lastNotification?.type === "new_message" && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    {lastNotification.count ?? 1}
                  </span>
                )}
              </div>
              <span className="text-sm text-muted-foreground">{admin.email}</span>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sign out
            </button>
          </div>
        </div>
        <main className="flex-1 px-4 py-8 md:px-8">{children}</main>
      </div>
    </div>
  );
}
