import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { getSettings } from "@/lib/services/settings";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description: "The terms that apply when you use this website or visit our café.",
  alternates: { canonical: "/terms" },
};

export default async function TermsPage() {
  const settings = await getSettings();

  const sections = [
    {
      title: "Use of this website",
      body: "This website is provided for information about our café and menu. You agree not to misuse the site, attempt unauthorised access, or submit false or abusive content through our forms.",
    },
    {
      title: "Menu and prices",
      body: "Dishes, ingredients and prices shown on this website are kept as current as possible but may change without notice. Prices displayed in the café prevail in case of any difference.",
    },
    {
      title: "Reservations and enquiries",
      body: "A message sent through this website is an enquiry, not a confirmed booking. A reservation is confirmed only when a member of our team confirms it with you directly.",
    },
    {
      title: "Allergens",
      body: "We handle nuts, dairy, gluten and other allergens in our kitchen. While we take care seriously, we cannot guarantee any dish is completely free of cross-contact. Always inform staff of allergies before ordering.",
    },
    {
      title: "Intellectual property",
      body: `The name ${settings.cafeName}, our logo, photography and website content belong to us and may not be reproduced without written permission.`,
    },
    {
      title: "Liability",
      body: "To the extent permitted by law, we are not liable for indirect losses arising from use of this website. Nothing in these terms limits liability that cannot be limited by law.",
    },
    {
      title: "Governing law",
      body: "These terms are governed by the laws of India, with courts in New Delhi having exclusive jurisdiction.",
    },
  ];

  return (
    <>
      <PageHeader
        title="Terms & Conditions"
        description="The short version: be kind, book through us directly, and tell us about allergies."
      />

      <div className="container-site max-w-3xl py-12 md:py-16">
        <p className="text-sm text-muted-foreground">Last updated: 20 August 2026</p>
        <div className="mt-8 space-y-8">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="heading-display text-xl">{section.title}</h2>
              <p className="mt-2 max-w-[65ch] leading-relaxed text-muted-foreground">
                {section.body}
              </p>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
