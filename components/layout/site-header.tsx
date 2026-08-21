"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Phone, X } from "lucide-react";
import { navigation } from "@/config/navigation";
import { cn } from "@/lib/utils/cn";
import { LogoMark, Wordmark } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";

export function SiteHeader({
  siteName,
  phone,
}: {
  siteName: string;
  phone: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const closeMenu = () => setOpen(false);

  React.useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md">
      <div className="container-site flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2.5" aria-label={`${siteName} home`}>
          <LogoMark />
          <Wordmark />
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main navigation">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition-colors hover:bg-muted",
                isActive(item.href) ? "text-primary" : "text-foreground"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <a
            href={`tel:${phone.replace(/\s/g, "")}`}
            className="flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            <Phone className="h-4 w-4" aria-hidden="true" />
            <span className="hidden lg:inline">{phone}</span>
          </a>
          <Link href="/menu" className={buttonVariants({ size: "sm" })}>
            View Menu
          </Link>
        </div>

        <button
          type="button"
          className="rounded-full p-2 text-foreground transition-colors hover:bg-muted md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open ? (
        <div className="border-t border-border bg-background md:hidden">
          <nav className="container-site flex flex-col gap-1 py-4" aria-label="Mobile navigation">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeMenu}
                className={cn(
                  "rounded-lg px-4 py-3 text-base font-medium transition-colors hover:bg-muted",
                  isActive(item.href) ? "text-primary" : "text-foreground"
                )}
              >
                {item.label}
              </Link>
            ))}
            <a
              href={`tel:${phone.replace(/\s/g, "")}`}
              className="flex items-center gap-2 rounded-lg px-4 py-3 text-base font-medium text-foreground"
            >
              <Phone className="h-5 w-5" aria-hidden="true" />
              Call us
            </a>
            <div className="px-4 pt-2">
              <Link href="/menu" onClick={closeMenu} className={cn(buttonVariants(), "w-full")}>
                View Menu
              </Link>
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}