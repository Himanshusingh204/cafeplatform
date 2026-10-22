export default function MenuLoading() {
  return (
    <div className="container-site py-12 md:py-16" aria-busy="true">
      <span role="status" className="sr-only">
        Loading menu
      </span>
      <div className="h-24 rounded-2xl bg-muted motion-safe:animate-pulse" />
      <div className="mt-8 flex gap-2 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 w-28 shrink-0 rounded-full bg-muted motion-safe:animate-pulse" />
        ))}
      </div>
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="aspect-[4/3] bg-muted motion-safe:animate-pulse" />
            <div className="space-y-3 p-5">
              <div className="h-5 w-2/3 rounded bg-muted motion-safe:animate-pulse" />
              <div className="h-4 w-full rounded bg-muted motion-safe:animate-pulse" />
              <div className="h-4 w-1/3 rounded bg-muted motion-safe:animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
