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

        <div className="flex items-center gap-2">
          {/* Cart Bag Button */}
          <button
            type="button"
            onClick={openCart}
            aria-label="View takeaway bag"
            className="relative flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted active:scale-95"
          >
            <ShoppingBag className="h-4 w-4 text-primary" />
            <span className="hidden sm:inline">Bag</span>
            {totalCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                {totalCount}
              </span>
            )}
          </button>

          <div className="hidden items-center gap-2 md:flex">
            <a
              href={`tel:${phone.replace(/\s/g, "")}`}
              className="flex items-center gap-2 rounded-full border border-border px-3.5 py-2 text-xs font-medium transition-colors hover:bg-muted"
            >
              <Phone className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              <span className="hidden lg:inline">{phone}</span>
            </a>
            <Link href="/reservations" className={buttonVariants({ size: "sm" })}>
              Book Table
            </Link>
          </div>

          <button
            type="button"
            className="rounded-full p-2 text-foreground transition-colors hover:bg-muted md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden border-t border-border bg-background md:hidden"
          >
            <nav className="container-site flex flex-col gap-1 py-4" aria-label="Mobile navigation">
              {navigation.map((item, i) => (
                <motion.div
                  key={item.href}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: i * 0.05, duration: 0.2 }}
                >
                  <Link
                    href={item.href}
                    onClick={closeMenu}
                    className={cn(
                      "rounded-lg px-4 py-3 text-base font-medium transition-colors hover:bg-muted",
                      isActive(item.href) ? "text-primary" : "text-foreground"
                    )}
                  >
                    {item.label}
                  </Link>
                </motion.div>
              ))}
              <motion.div
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: navigation.length * 0.05, duration: 0.2 }}
              >
                <a
                  href={`tel:${phone.replace(/\s/g, "")}`}
                  className="flex items-center gap-2 rounded-lg px-4 py-3 text-base font-medium text-foreground"
                >
                  <Phone className="h-5 w-5" aria-hidden="true" />
                  Call us
                </a>
              </motion.div>
              <motion.div
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: (navigation.length + 1) * 0.05, duration: 0.2 }}
                className="px-4 pt-2"
              >
                <Link href="/menu" onClick={closeMenu} className={cn(buttonVariants(), "w-full")}>
                  View Menu
                </Link>
              </motion.div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
