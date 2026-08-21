"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, LogOut, Menu, X } from "lucide-react";
import { adminNavigation } from "@/config/navigation";
import { cn } from "@/lib/utils/cn";
import { LogoMark, Wordmark } from "@/components/brand/logo";

const navIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  "/admin": LayoutDashboard,
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
        <div className="border-b border-border bg-card px-4 py-4 lg:hidden">{nav}</div>
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
          <p className="truncate text-xs text-muted-foreground">{admin.role.toLowerCase().replace("_", " ")}</p>
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
        <div className="hidden h-16 items-center justify-end gap-4 border-b border-border bg-card px-8 lg:flex">
          <span className="text-sm text-muted-foreground">{admin.email}</span>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sign out
          </button>
        </div>
        <main className="flex-1 px-4 py-8 md:px-8">{children}</main>
      </div>
    </div>
  );
}
