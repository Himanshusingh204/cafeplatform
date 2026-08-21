import Image from "next/image";
import Link from "next/link";
import { Reveal } from "@/components/ui/reveal";
import { buttonVariants } from "@/components/ui/button";

export function AboutPreview() {
  return (
    <section className="section-pad bg-muted/60">
      <div className="container-site grid items-center gap-10 md:grid-cols-2 md:gap-14">
        <Reveal>
          <div className="relative">
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl shadow-card">
              <Image
                src="/images/placeholders/about-placeholder.jpg"
                alt="Inside the café — warm, wood-toned and inviting"
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
            <div className="absolute -right-5 -top-5 hidden rounded-xl border border-border bg-card px-5 py-4 shadow-card sm:block">
              <p className="heading-display text-2xl">Est. 2019</p>
              <p className="text-sm text-muted-foreground">Serving Hauz Khas</p>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-primary">
              Our story
            </p>
            <h2 className="heading-display text-3xl md:text-4xl">
              A café built around honest, home-style cooking
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
              We started with a tandoor, a spice grinder and a simple idea — that
              Indian food deserves the same care as the best of any cuisine. Every
              gravy is cooked low and slow, every naan pulled fresh from the flame.
            </p>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              No shortcuts, no premade pastes. Just whole spices, honest ingredients
              and food made the way we&apos;d make it for our own family.
            </p>
            <div className="mt-8">
              <Link href="/about" className={buttonVariants({ variant: "outline" })}>
                Read our story
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}