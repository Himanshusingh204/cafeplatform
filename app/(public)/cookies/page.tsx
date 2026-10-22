import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/metadata";
import { PageHeader } from "@/components/layout/page-header";
import { getSettings } from "@/lib/services/settings";

export const revalidate = 300;

export const metadata: Metadata = pageMetadata({
  title: "Cookie Policy",
  description: "Which cookies and browser storage this website uses, and why.",
  path: "/cookies",
});

export default async function CookiesPage() {
  const settings = await getSettings();

  const sections = [
    {
      title: "What we use",
      body: "We keep this to the minimum the site needs to work. We do not use advertising, analytics or tracking cookies, so there is nothing to opt out of.",
    },
    {
      title: "Staff sign-in cookie",
      body: "A secure session cookie is set only when our staff sign in to the private admin area. It is removed when they sign out or the session expires. Visitors never receive it.",
    },
    {
      title: "Your takeaway bag",
      body: "The dishes in your bag are saved in your browser's local storage so they are still there if you reload the page. This data stays on your device and is not sent to us until you place an order. Clearing your browser data empties the bag.",
    },
    {
      title: "Security reports",
      body: "Your browser may send us an anonymous report if a page tries to load something our security policy blocks. These reports contain no personal details.",
    },
    {
      title: "Managing storage",
      body: "You can delete cookies and site data at any time from your browser settings. The site keeps working, but your bag will be empty.",
    },
    {
      title: "Questions",
      body: `Email ${settings.email} and we will answer within one working day.`,
    },
  ];

  return (
    <>
      <PageHeader
        title="Cookie Policy"
        description="No tracking and no advertising cookies. Only what the site needs to work."
      />
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
