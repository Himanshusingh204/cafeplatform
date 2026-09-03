import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/guards";
import { permissions } from "@/config/roles";
import { listReviewsAdmin, getReviewStats } from "@/lib/services/reviews";
import { ReviewManager } from "@/components/admin/review-manager";

export const metadata: Metadata = { title: "Customer Reviews" };
export const dynamic = "force-dynamic";

interface ReviewsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminReviewsPage({ searchParams }: ReviewsPageProps) {
  await requirePermission(permissions.VIEW_MESSAGES);
  const query = await searchParams;
  const approvedParam =
    query.status === "approved" ? true : query.status === "pending" ? false : undefined;

  const [data, stats] = await Promise.all([
    listReviewsAdmin({
      isApproved: approvedParam,
      pageSize: 50,
    }),
    getReviewStats(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="heading-display text-3xl">Customer Reviews</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Moderate customer feedback, star ratings, and feature reviews on the public site.
        </p>
      </div>

      {/* KPI Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <span className="text-xs text-muted-foreground font-medium">Pending Moderation</span>
          <p className="heading-display mt-1 text-2xl font-bold text-amber-500">{stats.pendingModeration}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <span className="text-xs text-muted-foreground font-medium">Approved Reviews</span>
          <p className="heading-display mt-1 text-2xl font-bold text-success">{stats.totalApproved}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <span className="text-xs text-muted-foreground font-medium">Average Diner Rating</span>
          <p className="heading-display mt-1 text-2xl font-bold text-primary">★ {stats.averageRating} / 5.0</p>
        </div>
      </div>

      <ReviewManager
        reviews={data.items.map((r) => ({
          id: r.id,
          customerName: r.customerName,
          rating: r.rating,
          title: r.title,
          comment: r.comment,
          dishSlug: r.dishSlug,
          isApproved: r.isApproved,
          isFeatured: r.isFeatured,
          createdAt: r.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
