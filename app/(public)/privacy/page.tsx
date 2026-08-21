import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { getSettings } from "@/lib/services/settings";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How we collect, use and protect your personal information.",
  alternates: { canonical: "/privacy" },
};

export default async function PrivacyPage() {
  const settings = await getSettings();

  const sections = [
    {
      title: "What we collect",
      body: `When you contact us through this website we store your name, email address, phone number (if provided) and your message, so that we can respond to you. We also keep a one-way hashed record of the sender's network address to prevent spam and abuse.`,
    },
    {
      title: "How we use it",
      body: "We use your details only to reply to your enquiry and, where you have asked us to, to manage a booking or event. We do not sell, rent or share your personal information with third parties for marketing.",
    },
    {
      title: "Cookies",
      body: "This website uses a single session cookie only for staff sign-in to the private admin area. Visitors browsing the public site are not tracked and no advertising cookies are set.",
    },
    {
      title: "Data retention",
      body: "Contact messages are kept while they remain useful for our correspondence with you, after which they are deleted or archived. You may ask us to delete your message at any time.",
    },
    {
      title: "Your rights",
      body: `You may request a copy of the information we hold about you, ask us to correct it, or ask us to delete it. To do so, email ${settings.email} and we will act on your request promptly.`,
    },
    {
      title: "Security",
      body: "Access to stored messages is restricted to authorised staff. Passwords are hashed, traffic is encrypted in transit, and administrative access is logged.",
    },
    {
      title: "Changes to this policy",
      body: "If we update this policy we will publish the new version on this page with a revised date.",
    },
  ];

  return (
    <>
      <PageHeader
        title="Privacy Policy"
        description="We collect as little as possible, use it only to serve you, and never sell it."
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
