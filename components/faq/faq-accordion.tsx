import Link from "next/link";

export interface FaqItem {
  q: string;
  a: string;
}

interface FaqAccordionProps {
  faqs: FaqItem[];
}

export function FaqAccordion({ faqs }: FaqAccordionProps) {
  return (
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
  );
}
