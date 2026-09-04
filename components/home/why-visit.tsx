import { Reveal } from "@/components/ui/reveal";
import { Flame, Sparkles, Clock, Coffee, ShieldCheck } from "lucide-react";

const facts = [
  {
    icon: Sparkles,
    term: "Fresh-Roasted Spices",
    detail: "Whole whole spices slow-roasted on thick cast-iron tawa and hand-ground every single morning.",
    tag: "No Artificial Flavours",
  },
  {
    icon: Flame,
    term: "Live Clay Tandoor",
    detail: "Lit at 8 AM over real charcoal embers. Naan and rotis go into the tandoor only the moment you order.",
    tag: "Authentic Smoke",
  },
  {
    icon: Clock,
    term: "16-Hour Gravies",
    detail: "Our signature Dal Makhani & butter gravies simmer slowly through the night. Zero shortcuts or canned pastes.",
    tag: "Slow-Food Heritage",
  },
  {
    icon: Coffee,
    term: "Heritage Masala Chai",
    detail: "Fresh crushed ginger, green cardamom, and Assam tea leaves brewed in small batches continuously.",
    tag: "Unlimited Refills",
  },
];

export function WhyVisit() {
  return (
    <section className="section-pad relative overflow-hidden bg-muted/25 border-y border-border/60">
      <div className="container-site grid gap-12 lg:grid-cols-12 lg:gap-16 items-start">
        <Reveal className="lg:col-span-5">
          <div className="lg:sticky lg:top-28 space-y-4">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Our Kitchen Philosophy</span>
            </div>
            <h2 className="heading-display text-balance text-3xl md:text-4xl lg:text-[2.6rem] font-bold leading-tight">
              Nothing in our kitchen ever comes out of a jar.
            </h2>
            <p className="text-pretty leading-relaxed text-muted-foreground text-sm sm:text-base">
              It takes more time and costs more effort — but authentic Mughlai and North Indian culinary traditions cannot be rushed. Every bite carries centuries of spice mastery.
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.1} className="lg:col-span-7">
          <div className="grid gap-4 sm:grid-cols-2">
            {facts.map((fact) => {
              const Icon = fact.icon;
              return (
                <div
                  key={fact.term}
                  className="rounded-2xl border border-border bg-card p-6 shadow-card hover:shadow-card-hover transition-all duration-300 hover:-translate-y-1 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      {fact.tag}
                    </span>
                  </div>
                  <h3 className="heading-display text-lg font-bold text-foreground">{fact.term}</h3>
                  <p className="text-xs leading-relaxed text-muted-foreground">{fact.detail}</p>
                </div>
              );
            })}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
