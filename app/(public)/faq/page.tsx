import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { getSettings } from "@/lib/services/settings";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Answers to common questions — reservations, dietary options, parking, takeaway and more.",
  alternates: { canonical: "/faq" },
};

function buildFaqs(phone: string) {
  return [
    {
      q: "Do you take reservations?",
      a: "Yes — call us and we will hold a table for you. Walk-ins are always welcome, though weekends can fill up quickly between 7 and 9 PM.",
    },
    {
      q: "Do you have vegetarian and vegan options?",
      a: "A large part of our menu is vegetarian, and several dishes are fully vegan or can be prepared vegan on request. Look for the green leaf on the menu, or just ask our team.",
    },
    {
      q: "How spicy is your food?",
      a: "Our dishes are seasoned the traditional way. If you prefer things mild, tell your server — most curries can be tempered to suit you.",
    },
    {
      q: "Can you cater for allergies?",
      a: "We handle nuts, dairy and gluten in our kitchen, so we cannot guarantee zero cross-contact. Tell us about any allergy before ordering and we will flag it to the kitchen.",
    },
    {
      q: "Do you offer takeaway?",
      a: "Yes, everything on the menu is available for takeaway. Call ahead at " +
        phone +
        " and we will have it ready.",
    },
    {
      q: "Is there parking nearby?",
      a: "Street parking is available around the lane, and a paid lot is two minutes' walk away. We are also a short ride from Hauz Khas metro station.",
    },
    {
      q: "Do you host private events?",
      a: "We do — birthdays, team dinners and small celebrations. Send us a message through the contact page with your date and group size.",
    },
  ];
}

export default async function FaqPage() {
  const settings = await getSettings();
  const faqs = buildFaqs(settings.phone);

  return (
    <>
      <PageHeader
        title="Frequently asked questions"
        description="Quick answers about reservations, dietary needs and visiting us."
      />

      <div className="container-site max-w-3xl py-12 md:py-16">
        <div className="divide-y divide-border rounded-xl border border-border bg-card shadow-card">
          {faqs.map((faq) => (
            <details key={faq.q} className="group px-6 py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
                {faq.q}
                <span
                  aria-hidden="true"
                  className="text-xl leading-none text-muted-foreground transition-transform duration-300 group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-3 max-w-[65ch] text-sm leading-relaxed text-muted-foreground">
                {faq.a}
              </p>
            </details>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          Still have a question?{" "}
          <Link href="/contact" className="font-medium text-primary hover:underline">
            Write to us
          </Link>{" "}
          — we reply within a day.
        </p>
      </div>
    </>
  );
}
