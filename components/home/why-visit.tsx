import { Reveal } from "@/components/ui/reveal";

const facts = [
  {
    term: "Spices",
    detail:
      "Whole masalas dry-roasted on the tawa and ground in-house every Monday morning.",
  },
  {
    term: "The tandoor",
    detail:
      "Lit at nine, still glowing past midnight. Naan goes in only when you order it.",
  },
  {
    term: "Gravies",
    detail:
      "The butter chicken base simmers for six hours. No paste, no shortcuts.",
  },
  {
    term: "Chai",
    detail: "Kettle stays on all day. Your second cup is on us.",
  },
];

export function WhyVisit() {
  return (
    <section className="section-pad">
      <div className="container-site grid gap-12 lg:grid-cols-[1fr_1.15fr] lg:gap-20">
        <Reveal>
          <div className="lg:sticky lg:top-28">
            <p className="eyebrow mb-4">How we cook</p>
            <h2 className="heading-display text-balance text-3xl md:text-[2.75rem] md:leading-[1.1]">
              Nothing here comes out of a jar.
            </h2>
            <p className="text-pretty mt-6 max-w-md leading-relaxed text-muted-foreground">
              It slows the kitchen down and it costs us more — and it is the
              only way we know to cook food worth coming back for.
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <dl className="divide-y divide-border border-b border-t border-border">
            {facts.map((fact) => (
              <div
                key={fact.term}
                className="grid gap-2 py-6 sm:grid-cols-[9rem_1fr] sm:gap-6"
              >
                <dt className="heading-display text-xl">{fact.term}</dt>
                <dd className="text-pretty max-w-md text-sm leading-relaxed text-muted-foreground">
                  {fact.detail}
                </dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
    </section>
  );
}
