import Link from "next/link";
import { MapPin, Phone, Mail, Clock } from "lucide-react";
import { LogoMark, Wordmark } from "@/components/brand/logo";
import type { SiteSettings } from "@/lib/services/settings";

const exploreLinks = [
  { label: "Menu", href: "/menu" },
  { label: "Reservations", href: "/reservations" },
  { label: "Waitlist", href: "/waitlist" },
  { label: "VIP Club", href: "/loyalty" },
  { label: "Gallery", href: "/gallery" },
  { label: "About us", href: "/about" },
];

const supportLinks = [
  { label: "Help centre", href: "/help" },
  { label: "FAQ", href: "/faq" },
  { label: "Contact", href: "/contact" },
  { label: "Privacy policy", href: "/privacy" },
  { label: "Terms & conditions", href: "/terms" },
  { label: "Cookie policy", href: "/cookies" },
  { label: "Cancellations & refunds", href: "/refunds" },
  { label: "Accessibility", href: "/accessibility" },
];

const linkClass = "text-sm text-[#f3e9dc] transition-colors hover:text-[#f0a47f]";
const headingClass = "text-sm font-semibold uppercase tracking-wide text-[#d8c7b4]";

export function SiteFooter({ settings }: { settings: SiteSettings }) {
  let hours: Record<string, string> = {};
  try {
    hours = JSON.parse(settings.openingHours || "{}") as Record<string, string>;
  } catch {
    hours = {};
  }
  const today = hours[new Date().toLocaleDateString("en-IN", { weekday: "long" }).toLowerCase()];
  const whatsapp = settings.whatsapp?.replace(/\D/g, "");

  const socials = [
    { label: "Instagram", href: settings.instagram },
    { label: "Facebook", href: settings.facebook },
    { label: "WhatsApp", href: whatsapp ? `https://wa.me/${whatsapp}` : "" },
  ].filter((x) => x.href);

  return (
    <footer className="bg-[#3a2418] text-[#f3e9dc]">
      <div className="container-site grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.3fr]">
        <div>
          <Link href="/" className="inline-flex items-center gap-2.5" aria-label={`${settings.cafeName} home`}>
            <LogoMark />
            <Wordmark className="text-[#f3e9dc] [&_span]:text-[#f0a47f]" />
          </Link>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-[#d8c7b4]">{settings.tagline}</p>
          <ul className="mt-5 flex gap-3">
            {socials.map(({ label, href }) => (
              <li key={label}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 items-center rounded-full border border-white/20 px-4 text-xs font-medium text-[#f3e9dc] transition-colors hover:border-[#f0a47f] hover:text-[#f0a47f]"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <nav aria-label="Explore">
          <h2 className={headingClass}>Explore</h2>
          <ul className="mt-4 space-y-2.5">
            {exploreLinks.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={linkClass}>{item.label}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Support and legal">
          <h2 className={headingClass}>Support</h2>
          <ul className="mt-4 space-y-2.5">
            {supportLinks.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={linkClass}>{item.label}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className={headingClass}>Visit us</h2>
          <ul className="mt-4 space-y-3 text-sm text-[#f3e9dc]">
            <li className="flex items-start gap-2.5">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#f0a47f]" aria-hidden="true" />
              <a href={settings.mapsLink} target="_blank" rel="noopener noreferrer" className="hover:text-[#f0a47f]">
                {settings.address}
              </a>
            </li>
            <li className="flex items-center gap-2.5">
              <Phone className="h-4 w-4 shrink-0 text-[#f0a47f]" aria-hidden="true" />
              <a href={`tel:${settings.phone.replace(/\s/g, "")}`} className="hover:text-[#f0a47f]">{settings.phone}</a>
            </li>
            <li className="flex items-start gap-2.5">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-[#f0a47f]" aria-hidden="true" />
              <a href={`mailto:${settings.email}`} className="min-w-0 break-words hover:text-[#f0a47f]">{settings.email}</a>
            </li>
            <li className="flex items-start gap-2.5">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[#f0a47f]" aria-hidden="true" />
              <span>{today ? `Today: ${today}` : "Open all week"}</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/15">
        <div className="container-site flex flex-col items-center justify-between gap-2 py-5 text-xs text-[#d8c7b4] sm:flex-row">
          <p>&copy; {new Date().getFullYear()} {settings.cafeName}. All rights reserved.</p>
          <p>Made in New Delhi.</p>
        </div>
      </div>
    </footer>
  );
}
