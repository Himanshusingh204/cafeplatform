import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { FaqAccordion } from "@/components/faq/faq-accordion";
import { getSettings } from "@/lib/services/settings";

export const revalidate = 300;

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

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.a,
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PageHeader
        title="Frequently asked questions"
        description="Quick answers about reservations, dietary needs and visiting us."
      />

      <FaqAccordion faqs={faqs} />
    </>
  );
}
