import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/seo/metadata";
import { PageHeader } from "@/components/layout/page-header";
import { getSettings } from "@/lib/services/settings";

export const revalidate = 300;

export const metadata: Metadata = pageMetadata({
  title: "Help Centre",
  description: "Find answers about orders, reservations, the waitlist and rewards, or get in touch with our team.",
  path: "/help",
});

const topics = [
  { title: "Reserve a table", text: "Book, check or change a reservation with your reference code.", href: "/reservations" },
  { title: "Join the waitlist", text: "Walk-in? Add your name and we will message you when a table is ready.", href: "/waitlist" },
  { title: "Takeaway orders", text: "Add dishes to your bag and check out. Your order page shows live status.", href: "/menu" },
  { title: "VIP Club rewards", text: "Earn and check loyalty points with your phone number.", href: "/loyalty" },
  { title: "Common questions", text: "Allergies, parking, group bookings and more.", href: "/faq" },
  { title: "Write to us", text: "Events, feedback or anything else.", href: "/contact" },
];

export default async function HelpPage() {
  const settings = await getSettings();
  const phone = settings.phone.replace(/\s/g, "");

  return (
    <>
      <PageHeader title="Help centre" description="Pick a topic, or talk to us directly." />
      <div className="container-site py-10 md:py-12">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {topics.map((t) => (
            <li key={t.href}>
              <Link
                href={t.href}
                className="block h-full rounded-2xl border border-border bg-card p-5 shadow-card transition-colors hover:border-primary/50"
              >
                <h2 className="heading-display text-lg">{t.title}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{t.text}</p>
              </Link>
            </li>
          ))}
        </ul>

        <section className="mt-10 rounded-2xl bg-secondary p-6 md:p-8">
          <h2 className="heading-display text-xl">Need a person?</h2>
          <p className="mt-2 text-secondary-foreground">
            Call <a className="font-semibold underline underline-offset-4" href={`tel:${phone}`}>{settings.phone}</a> or
            email <a className="break-words font-semibold underline underline-offset-4" href={`mailto:${settings.email}`}>{settings.email}</a>.
            We usually reply within one working day.
          </p>
        </section>
      </div>
    </>
  );
}
