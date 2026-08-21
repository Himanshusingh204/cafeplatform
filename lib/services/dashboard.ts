import "server-only";

import { db } from "@/lib/db/prisma";

export async function getDashboardStats() {
  const [totalDishes, activeCategories, featuredItems, newMessages] = await Promise.all([
    db.dish.count({ where: { deletedAt: null } }),
    db.category.count({ where: { deletedAt: null, isActive: true } }),
    db.dish.count({ where: { deletedAt: null, isFeatured: true } }),
    db.contactMessage.count({ where: { status: "NEW" } }),
  ]);

  return { totalDishes, activeCategories, featuredItems, newMessages };
}

export async function getRecentActivity(limit = 8) {
  return db.activityLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { actor: { select: { name: true } } },
  });
}

export async function getRecentDishes(limit = 5) {
  return db.dish.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, name: true, price: true, isAvailable: true, updatedAt: true },
  });
}
