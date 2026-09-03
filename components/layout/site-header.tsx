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

export function SiteHeader({
  siteName,
  phone,
}: {
  siteName: string;
  phone: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const { openCart, totalCount } = useCart();

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
    <header className="sticky top-0 z-40 glass-nav transition-all duration-300">
      <div className="container-site flex h-16 items-center justify-between gap-4">
        <Link href="/" className="group flex items-center gap-2.5 transition-transform duration-200 active:scale-95" aria-label={`${siteName} home`}>
          <LogoMark />
          <Wordmark />
        </Link>

        <nav className="relative hidden items-center gap-1 rounded-full border border-border/50 bg-background/50 p-1 backdrop-blur-md md:flex" aria-label="Main navigation">
          {navigation.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-200",
                  active ? "text-primary font-semibold" : "text-foreground/80 hover:text-foreground"
                )}
              >
                {active && (
                  <motion.span
                    layoutId="active-nav-indicator"
                    className="absolute inset-0 rounded-full bg-primary/10 border border-primary/20 shadow-xs"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <span className="relative z-10">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          {/* Cart Bag Button */}
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.94 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            type="button"
            onClick={openCart}
            aria-label="View takeaway bag"
            className="relative flex items-center gap-1.5 rounded-full border border-border/70 bg-card/80 px-3.5 py-2 text-xs font-semibold text-foreground shadow-xs backdrop-blur-sm transition-colors hover:bg-muted/80 hover:border-border"
          >
            <ShoppingBag className="h-4 w-4 text-primary" />
            <span className="hidden sm:inline">Bag</span>
            {totalCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shadow-xs"
              >
                {totalCount}
              </motion.span>
            )}
          </motion.button>

          <div className="hidden items-center gap-2 md:flex">
            <motion.a
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              href={`tel:${phone.replace(/\s/g, "")}`}
              className="flex items-center gap-2 rounded-full border border-border/70 bg-card/60 px-3.5 py-2 text-xs font-medium text-foreground/90 backdrop-blur-xs transition-colors hover:bg-muted/80"
            >
              <Phone className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              <span className="hidden lg:inline">{phone}</span>
            </motion.a>
            <motion.div
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
            >
              <Link href="/reservations" className={cn(buttonVariants({ size: "sm" }), "shadow-xs")}>
                Book Table
              </Link>
            </motion.div>
          </div>

          <motion.button
            whileTap={{ scale: 0.92 }}
            type="button"
            className="rounded-full border border-border/60 bg-card/60 p-2 text-foreground backdrop-blur-sm transition-colors hover:bg-muted md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </motion.button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-t border-border/60 glass-panel md:hidden"
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
