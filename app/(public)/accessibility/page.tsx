import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/metadata";
import { PageHeader } from "@/components/layout/page-header";
import { getSettings } from "@/lib/services/settings";

export const revalidate = 300;

export const metadata: Metadata = pageMetadata({
  title: "Accessibility Statement",
  description: "How we make this website usable for everyone and how to report a problem.",
  path: "/accessibility",
});

export default async function AccessibilityPage() {
  const settings = await getSettings();

  const sections = [
    {
      title: "Our commitment",
      body: "We want everyone to be able to browse our menu, book a table and place an order. We aim to meet the WCAG 2.1 level AA guidelines.",
    },
    {
      title: "What we do",
      body: "Pages use proper headings and landmarks, every image has a text description, forms have visible labels, text meets minimum colour contrast, and the whole site can be used with a keyboard. We test pages with automated accessibility tools.",
    },
    {
      title: "Known limits",
      body: "The embedded map on the contact page is provided by a third party and may not be fully accessible. Use the address, phone number and Open in Maps link instead.",
    },
    {
      title: "Tell us about a problem",
      body: `If something is hard to use, email ${settings.email} or call ${settings.phone}. Tell us the page and what happened and we will fix it or help you another way.`,
    },
  ];

  return (
    <>
      <PageHeader title="Accessibility Statement" description="Built to be used by everyone, with a keyboard, a screen reader or a phone." />
      <div className="container-site max-w-3xl py-10 md:py-12">
        <p className="text-sm text-muted-foreground">Last updated: 22 October 2026</p>
        <div className="mt-6 space-y-7">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="heading-display text-xl">{section.title}</h2>
              <p className="mt-2 max-w-[65ch] leading-relaxed text-muted-foreground">{section.body}</p>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
