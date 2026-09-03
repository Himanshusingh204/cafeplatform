import "server-only";

import { unstable_cache } from "next/cache";
import { db } from "@/lib/db/prisma";
import { logAction } from "@/lib/services/audit";

export interface CreateReviewInput {
  customerName: string;
  rating: number;
  title: string;
  comment: string;
  dishSlug?: string;
}

export async function createReview(input: CreateReviewInput) {
  const rating = Math.max(1, Math.min(5, Math.round(input.rating)));

  const review = await db.review.create({
    data: {
      customerName: input.customerName.trim(),
      rating,
      title: input.title.trim(),
      comment: input.comment.trim(),
      dishSlug: input.dishSlug?.trim() || null,
      isApproved: false, // Moderated before public display
      isFeatured: false,
    },
  });

  return review;
}

async function fetchApprovedReviews(dishSlug?: string) {
  try {
    const where: Record<string, unknown> = { isApproved: true };
    if (dishSlug) {
      where.dishSlug = dishSlug;
    }

    return await db.review.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 20,
    });
  } catch (error) {
    console.error("fetchApprovedReviews error:", error);
    return [];
  }
}

export const getApprovedReviewsCached = unstable_cache(
  fetchApprovedReviews,
  ["approved-reviews"],
  { tags: ["reviews"], revalidate: 300 }
);

export async function getApprovedReviews(dishSlug?: string) {
  return getApprovedReviewsCached(dishSlug);
}

export async function listReviewsAdmin(options?: {
  isApproved?: boolean;
  page?: number;
  pageSize?: number;
}) {
  try {
    const page = Math.max(1, options?.page ?? 1);
    const pageSize = Math.max(1, Math.min(100, options?.pageSize ?? 30));
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = {};
    if (options?.isApproved !== undefined) {
      where.isApproved = options.isApproved;
    }

    const [items, total] = await Promise.all([
      db.review.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      db.review.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  } catch (error) {
    console.error("listReviewsAdmin error:", error);
    return { items: [], total: 0, page: 1, pageSize: 30, totalPages: 0 };
  }
}

export async function moderateReview(
  id: string,
  data: { isApproved?: boolean; isFeatured?: boolean },
  actorId?: string | null
) {
  const updated = await db.review.update({
    where: { id },
    data,
  });

  await logAction({
    actorId,
    action: "REVIEW_MODERATED",
    entityType: "Review",
    entityId: id,
    metadata: { isApproved: updated.isApproved, isFeatured: updated.isFeatured },
  });

  return updated;
}

export async function deleteReview(id: string, actorId?: string | null) {
  const deleted = await db.review.delete({
    where: { id },
  });

  await logAction({
    actorId,
    action: "DELETE",
    entityType: "Review",
    entityId: id,
    metadata: { customerName: deleted.customerName },
  });

  return deleted;
}

export async function getReviewStats() {
  try {
    const [totalApproved, pendingModeration, avgRatingAgg] = await Promise.all([
      db.review.count({ where: { isApproved: true } }),
      db.review.count({ where: { isApproved: false } }),
      db.review.aggregate({
        where: { isApproved: true },
        _avg: { rating: true },
      }),
    ]);

    return {
      totalApproved,
      pendingModeration,
      averageRating: avgRatingAgg._avg.rating ? Number(avgRatingAgg._avg.rating.toFixed(1)) : 5.0,
    };
  } catch (error) {
    console.error("getReviewStats error:", error);
    return { totalApproved: 0, pendingModeration: 0, averageRating: 5.0 };
  }
}
