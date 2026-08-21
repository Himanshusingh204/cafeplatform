import { Leaf, Flame, HeartHandshake } from "lucide-react";
import { Reveal } from "@/components/ui/reveal";

const reasons = [
  {
    icon: Leaf,
    title: "Superior ingredients",
    description:
      "Every dish starts with whole spices, fresh herbs and produce sourced from trusted suppliers who share our values.",
  },
  {
    icon: Flame,
    title: "Traditional techniques",
    description:
      "Slow-cooked curries, charcoal-grilled tandoor and breads made to order — the methods that give Indian food its soul.",
  },
  {
    icon: HeartHandshake,
    title: "Warm hospitality",
    description:
      "We treat every guest like family. Come for a quick lunch or a long dinner — you will always be looked after.",
  },
];

export function WhyVisit() {
  return (
    <section className="section-pad">
      <div className="container-site">
        <Reveal>
          <div className="mb-10 text-center">
            <h2 className="heading-display text-3xl md:text-4xl">A café experience like no other</h2>
          </div>
        </Reveal>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {reasons.map((reason, index) => (
            <Reveal key={reason.title} delay={index * 0.08}>
              <div className="flex h-full items-start gap-3 rounded-xl border border-border bg-card p-5 shadow-card transition-all duration-300 hover:shadow-card-hover">
                <div className="flex-shrink-0 rounded-full bg-primary/10 p-3">
                  <reason.icon className="h-5 w-5 text-primary" aria-hidden="true" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-lg">{reason.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{reason.description}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
