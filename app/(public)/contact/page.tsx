import type { Metadata } from "next";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { ContactForm } from "@/components/contact/contact-form";
import { getSettings } from "@/lib/services/settings";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Visit us in Hauz Khas, call us, or send a message. Address, phone number, opening hours and contact form.",
  alternates: { canonical: "/contact" },
};

export default async function ContactPage() {
  const settings = await getSettings();
  let hours: Record<string, string> = {};
  try {
    hours = JSON.parse(settings.openingHours || "{}") as Record<string, string>;
  } catch {
    hours = {};
  }
  const today = hours[new Date().toLocaleDateString("en-IN", { weekday: "long" }).toLowerCase()];

  return (
    <>
      <PageHeader
        title="Get in touch"
        description="Questions about the menu, a large order or a private event? Call, write or simply walk in."
      />

      <div className="container-site grid gap-12 py-12 md:py-16 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
        <div>
          <h2 className="heading-display text-2xl">Visit us</h2>
          <ul className="mt-6 space-y-5">
            <li className="flex items-start gap-3">
              <MapPin className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <div>
                <p className="font-medium">Address</p>
                <a
                  href={settings.mapsLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground hover:text-primary"
                >
                  {settings.address}
                </a>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <Phone className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <div>
                <p className="font-medium">Phone</p>
                <a
                  href={`tel:${settings.phone.replace(/\s/g, "")}`}
                  className="text-sm text-muted-foreground hover:text-primary"
                >
                  {settings.phone}
                </a>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <Mail className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <div>
                <p className="font-medium">Email</p>
                <a
                  href={`mailto:${settings.email}`}
                  className="text-sm text-muted-foreground hover:text-primary"
                >
                  {settings.email}
                </a>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <Clock className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <div>
                <p className="font-medium">Opening hours</p>
                {today ? (
                  <p className="text-sm font-medium text-foreground">Today: {today}</p>
                ) : null}
                <dl className="mt-1 space-y-0.5 text-sm text-muted-foreground">
                  {Object.entries(hours).map(([day, time]) => (
                    <div key={day} className="flex gap-2">
                      <dt className="w-24 capitalize">{day}</dt>
                      <dd>{time}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </li>
          </ul>

          <div className="mt-8 overflow-hidden rounded-xl border border-border shadow-card">
            <iframe
              title={`Map to ${settings.cafeName}`}
              src={`https://www.google.com/maps?q=${encodeURIComponent(settings.address)}&output=embed`}
              width="600"
              height="280"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="h-64 w-full border-0"
            />
          </div>
        </div>

        <div>
          <h2 className="heading-display text-2xl">Send us a message</h2>
          <p className="mb-6 mt-2 text-sm text-muted-foreground">
            We read everything and usually reply within one working day.
          </p>
          <ContactForm />
        </div>
      </div>
    </>
  );
}
