import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6" role="status" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-48" />
      <div className="space-y-5 rounded-xl border border-border bg-card p-6 shadow-card">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i}>
            <Skeleton className="h-4 w-28" />
            <Skeleton className="mt-2 h-10 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
