import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/ui/reveal";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

interface ValueItem {
  title: string;
  body: string;
}

const DEFAULT_VALUES: ValueItem[] = [
  {
    title: "Whole spices only",
    body: "We grind our own garam masala weekly and temper every dish to order. No premade pastes, ever.",
  },
  {
    title: "Cooked low and slow",
    body: "Our dal simmers overnight. Our curries reduce naturally — no thickeners, no shortcuts.",
  },
  {
    title: "Honest hospitality",
    body: "Regulars are greeted by name and first-timers leave as regulars. That is the whole business plan.",
  },
];

export function AboutValues({ values = DEFAULT_VALUES }: { values?: ValueItem[] }) {
  return (
    <>
      <section className="section-pad">
        <div className="container-site grid items-center gap-10 md:grid-cols-2 md:gap-14">
          <Reveal>
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl shadow-card">
              <Image
                src="/images/about/cafe-interior.jpg"
                alt="The café interior — warm wood, soft light, open kitchen"
                fill
                priority
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="max-w-xl">
              <h2 className="heading-display text-3xl md:text-4xl">Our story</h2>
              <p className="mt-5 leading-relaxed text-muted-foreground">
                Spice &amp; Saffron began in 2019 as a weekend pop-up run from a
                family kitchen in Hauz Khas. The recipes came from three
                generations of home cooks — the kind of food that takes hours
                and tastes like it.
              </p>
              <p className="mt-4 leading-relaxed text-muted-foreground">
                Today we sit on the same lane, with a slightly bigger kitchen and
                the same rule: if we would not serve it to our own family, it
                does not leave the kitchen.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section-pad bg-muted/60">
        <div className="container-site max-w-4xl">
          <Reveal>
            <p className="eyebrow mb-3">What we believe</p>
            <h2 className="heading-display max-w-xl text-3xl md:text-4xl">
              Three rules, kept since day one
            </h2>
          </Reveal>
          <dl className="mt-12 divide-y divide-border border-b border-t border-border">
            {values.map((value) => (
              <div
                key={value.title}
                className="grid gap-2 py-7 md:grid-cols-[14rem_1fr] md:gap-8"
              >
                <dt className="heading-display text-xl md:text-[1.35rem]">
                  {value.title}
                </dt>
                <dd className="text-pretty max-w-lg text-sm leading-relaxed text-muted-foreground md:text-base">
                  {value.body}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="section-pad">
        <div className="container-site grid items-center gap-10 md:grid-cols-2 md:gap-14">
          <Reveal>
            <div className="max-w-xl md:order-last">
              <h2 className="heading-display text-3xl md:text-4xl">From our kitchen</h2>
              <p className="mt-5 leading-relaxed text-muted-foreground">
                The tandoor runs from opening to close. Breads are pulled to
                order, tikka is charcoal-grilled in small batches, and desserts
                are set fresh each morning. When something sells out, it is
                gone — that is how freshness works.
              </p>
              <div className="mt-8">
                <Link href="/menu" className={cn(buttonVariants(), "group")}>
                  See what is on today
                  <ArrowRight
                    className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </Link>
              </div>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl shadow-card">
              <Image
                src="/images/about/chef-tandoor.jpg"
                alt="Our chef at the tandoor during service"
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
