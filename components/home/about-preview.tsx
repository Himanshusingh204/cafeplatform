import Image from "next/image";
import Link from "next/link";
import { Reveal } from "@/components/ui/reveal";
import { buttonVariants } from "@/components/ui/button";

export function AboutPreview() {
  return (
    <section className="section-pad bg-muted/60">
      <div className="container-site grid items-center gap-10 md:grid-cols-2 md:gap-16">
        <Reveal>
          <div className="relative mx-auto w-full max-w-md md:max-w-none">
            <div className="relative aspect-[4/5] overflow-hidden rounded-2xl shadow-card">
              <Image
                src="/images/about/cafe-interior.jpg"
                alt="Inside the café — warm, wood-toned and inviting"
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
            <p className="mt-4 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              The dining room, Hauz Khas Village
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div>
            <p className="eyebrow mb-3">Our story</p>
            <h2 className="heading-display text-balance text-3xl md:text-4xl">
              A tandoor, a spice grinder, and a small room on the corner
            </h2>
            <p className="text-pretty mt-6 leading-relaxed text-muted-foreground">
              We opened in 2019 with those three things. The menu was short,
              the chairs didn&apos;t all match, and the gravies took as long as
              they take. Most of that hasn&apos;t changed.
            </p>
            <p className="text-pretty mt-4 leading-relaxed text-muted-foreground">
              No premade pastes, no food colour in the tandoori marinade.
              Whole spices, honest ingredients, and food made the way we&apos;d
              make it for our own family.
            </p>
            <div className="mt-8 flex items-center gap-6">
              <Link href="/about" className={buttonVariants({ variant: "outline" })}>
                Read our story
              </Link>
              <span className="text-sm text-muted-foreground">Est. 2019</span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
