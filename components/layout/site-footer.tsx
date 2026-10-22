import Link from "next/link";
import { MapPin, Phone, Mail, Clock } from "lucide-react";
import { navigation } from "@/config/navigation";
import { LogoMark, Wordmark } from "@/components/brand/logo";
import type { SiteSettings } from "@/lib/services/settings";

export function SiteFooter({ settings }: { settings: SiteSettings }) {
  let hours: Record<string, string> = {};
  try {
    hours = JSON.parse(settings.openingHours || "{}") as Record<string, string>;
  } catch {
    hours = {};
  }
  const today = hours[new Date().toLocaleDateString("en-IN", { weekday: "long" }).toLowerCase()];

  return (
    <footer className="bg-[#3a2418] text-[#f3e9dc]">
      <div className="container-site grid gap-10 py-14 md:grid-cols-4">
        <div className="md:col-span-2">
          <Link href="/" className="flex items-center gap-2.5" aria-label={`${settings.cafeName} home`}>
            <LogoMark />
            <Wordmark />
          </Link>
          <p className="mt-4 max-w-sm text-sm text-[#d8c7b4]">
            {settings.tagline}
          </p>
        </div>

        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[#d8c7b4]">
            Explore
          </h2>
          <ul className="mt-4 space-y-2.5">
            {navigation.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-sm text-[#f3e9dc] hover:text-[#f0a47f]">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[#d8c7b4]">
            Visit us
          </h2>
          <ul className="mt-4 space-y-3 text-sm text-[#f3e9dc]">
            <li className="flex items-start gap-2.5">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#f0a47f]" aria-hidden="true" />
              <a href={settings.mapsLink} target="_blank" rel="noopener noreferrer">
                {settings.address}
              </a>
            </li>
            <li className="flex items-center gap-2.5">
              <Phone className="h-4 w-4 shrink-0 text-[#f0a47f]" aria-hidden="true" />
              <a href={`tel:${settings.phone.replace(/\s/g, "")}`}>{settings.phone}</a>
            </li>
            <li className="flex items-center gap-2.5">
              <Mail className="h-4 w-4 shrink-0 text-[#f0a47f]" aria-hidden="true" />
              <a href={`mailto:${settings.email}`}>{settings.email}</a>
            </li>
            <li className="flex items-start gap-2.5">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[#f0a47f]" aria-hidden="true" />
              <span>
                {today ? `Today: ${today}` : "Open all week"}
              </span>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/15">
        <div className="container-site flex flex-col items-center justify-between gap-3 py-6 text-xs text-[#d8c7b4] sm:flex-row">
          <p className="flex items-center gap-1.5">
            <span>© {new Date().getFullYear()} {settings.cafeName}.</span>
            <span className="hidden sm:inline text-[#d8c7b4]/80">· Handcrafted with roasted spices, charcoal embers &amp; heartfelt hospitality.</span>
          </p>
          <div className="flex items-center gap-5">
            <Link href="/privacy" className="hover:text-white">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-white">Terms &amp; Conditions</Link>
            <Link href="/faq" className="hover:text-white">FAQ</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}