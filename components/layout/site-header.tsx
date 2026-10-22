"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Phone, X, ShoppingBag } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { navigation } from "@/config/navigation";
import { cn } from "@/lib/utils/cn";
import { LogoMark, Wordmark } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";
import { useCart } from "@/hooks/use-cart";

const primaryNav = navigation.filter((n) =>
  ["/", "/menu", "/reservations", "/about", "/contact"].includes(n.href)
);

export function SiteHeader({
  siteName,
  phone,
}: {
  siteName: string;
  phone: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const { openCart, totalCount, hydrated } = useCart();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const closeMenu = () => setOpen(false);

  const toggleRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);

  // Escape closes and returns focus to the toggle; focus moves into the menu on open.
  React.useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>("a")?.focus();
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const skipToContent = (ev: React.MouseEvent<HTMLAnchorElement>) => {
    const main = document.querySelector<HTMLElement>("main");
    if (!main) return;
    ev.preventDefault();
    main.setAttribute("tabindex", "-1");
    main.focus();
    main.scrollIntoView();
  };

  React.useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b-2 border-primary/30 bg-secondary shadow-sm">
      <a
        href="#main-content"
        onClick={skipToContent}
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <div className="container-site flex h-16 items-center justify-between gap-4">
        <Link href="/" className="group flex items-center gap-2.5 transition-transform duration-200 active:scale-95" aria-label={`${siteName} home`}>
          <LogoMark />
          <Wordmark />
        </Link>

        <nav className="hidden items-center gap-7 lg:flex" aria-label="Main navigation">
          {primaryNav.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-secondary-foreground hover:bg-primary/10 hover:text-primary"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openCart}
            aria-label="View takeaway bag"
            className="relative flex h-10 w-10 items-center justify-center rounded-full text-primary transition-colors hover:bg-primary/10"
          >
            <ShoppingBag className="h-5 w-5" />
            {hydrated && totalCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                {totalCount}
              </span>
            )}
          </button>

          <Link href="/reservations" className={cn(buttonVariants({ size: "sm" }), "hidden lg:inline-flex")}>
            Book Table
          </Link>

          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted lg:hidden"
            ref={toggleRef}
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-nav"
            ref={menuRef}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-t border-border/60 glass-panel lg:hidden"
          >
            <nav className="container-site flex flex-col gap-1 py-4" aria-label="Mobile navigation">
              {navigation.map((item, i) => (
                <motion.div
                  key={item.href}
                  initial={{ x: -16, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: i * 0.04, duration: 0.25, ease: "easeOut" }}
                >
                  <Link
                    href={item.href}
                    onClick={closeMenu}
                    className={cn(
                      "flex items-center justify-between rounded-xl px-4 py-3 text-base font-medium transition-colors hover:bg-muted/70",
                      isActive(item.href) ? "bg-primary/10 text-primary font-semibold" : "text-foreground"
                    )}
                  >
                    <span>{item.label}</span>
                  </Link>
                </motion.div>
              ))}
              <motion.div
                initial={{ x: -16, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: navigation.length * 0.04, duration: 0.25 }}
              >
                <a
                  href={`tel:${phone.replace(/\s/g, "")}`}
                  className="flex items-center gap-2 rounded-xl px-4 py-3 text-base font-medium text-foreground transition-colors hover:bg-muted/70"
                >
                  <Phone className="h-5 w-5 text-primary" aria-hidden="true" />
                  Call us: {phone}
                </a>
              </motion.div>
              <motion.div
                initial={{ x: -16, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: (navigation.length + 1) * 0.04, duration: 0.25 }}
                className="px-4 pt-2"
              >
                <Link href="/reservations" onClick={closeMenu} className={cn(buttonVariants(), "w-full shadow-sm")}>
                  Book Table
                </Link>
              </motion.div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
