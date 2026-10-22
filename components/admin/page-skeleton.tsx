import { Skeleton } from "@/components/ui/skeleton";

/** Header + toolbar + list skeleton shared by admin route loading states. */
export function AdminListSkeleton({ rows = 6, grid = false }: { rows?: number; grid?: boolean }) {
  return (
    <div className="space-y-6" role="status" aria-busy="true" aria-label="Loading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-2 h-4 w-64 max-w-full" />
        </div>
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>
      {grid ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-4 shadow-card">
              <Skeleton className="h-32 w-full rounded-lg" />
              <Skeleton className="mt-3 h-4 w-2/3" />
              <Skeleton className="mt-2 h-3 w-1/3" />
            </div>
          ))}
        </div>
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border bg-card shadow-card">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4">
              <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
              <div className="flex-1">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="mt-2 h-3 w-1/3" />
              </div>
              <Skeleton className="hidden h-6 w-16 rounded-full sm:block" />
            </div>
          ))}
        </div>
      )}
      <span className="sr-only">Loading</span>
    </div>
  );
}
