import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/metadata";
import { PageHeader } from "@/components/layout/page-header";
import { getSettings } from "@/lib/services/settings";

export const revalidate = 300;

export const metadata: Metadata = pageMetadata({
  title: "Cancellations and Refunds",
  description: "How reservation and takeaway cancellations and refunds work.",
  path: "/refunds",
});

export default async function RefundsPage() {
  const settings = await getSettings();

  const sections = [
    {
      title: "Reservations",
      body: "Tables are held for 15 minutes past the booking time. To change or cancel, contact us as early as you can, using your booking reference.",
    },
    {
      title: "Takeaway orders",
      body: "Orders are prepared fresh, so they can only be cancelled before the kitchen starts cooking. Call us straight away if you need to cancel.",
    },
    {
      title: "Refunds",
      body: "If an order is cancelled by us, or a payment is taken in error, we refund it to the original payment method. Banks usually take 5 to 7 working days to show it.",
    },
    {
      title: "Problem with your food",
      body: `If something is wrong with your order, tell us on the day at ${settings.phone} or ${settings.email} and we will make it right.`,
    },
  ];

  return (
    <>
      <PageHeader title="Cancellations and Refunds" description="Plain rules for cancelling a booking or an order." />
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
