export function PageHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <section className="border-b border-border bg-muted/50">
      <div className="container-site py-10 md:py-12">
        <div>
          <h1 className="heading-display max-w-2xl text-4xl md:text-5xl">{title}</h1>
          {description ? (
            <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
