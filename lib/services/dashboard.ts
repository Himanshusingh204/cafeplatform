import "server-only";

import { db } from "@/lib/db/prisma";

export async function getDashboardStats() {
  try {
    const [
      totalDishes,
      availableDishes,
      activeCategories,
      featuredItems,
      totalMessages,
      newMessages,
      galleryPhotos,
      vegetarianCount,
      veganCount,
      spicyCount,
    ] = await Promise.all([
      db.dish.count({ where: { deletedAt: null } }),
      db.dish.count({ where: { deletedAt: null, isAvailable: true } }),
      db.category.count({ where: { deletedAt: null, isActive: true } }),
      db.dish.count({ where: { deletedAt: null, isFeatured: true } }),
      db.contactMessage.count(),
      db.contactMessage.count({ where: { status: "NEW" } }),
      db.galleryImage.count({ where: { isPublished: true } }),
      db.dish.count({ where: { deletedAt: null, isVegetarian: true } }),
      db.dish.count({ where: { deletedAt: null, isVegan: true } }),
      db.dish.count({ where: { deletedAt: null, isSpicy: true } }),
    ]);

    return {
      totalDishes,
      availableDishes,
      hiddenDishes: Math.max(0, totalDishes - availableDishes),
      activeCategories,
      featuredItems,
      totalMessages,
      newMessages,
      galleryPhotos,
      vegetarianCount,
      veganCount,
      spicyCount,
    };
  } catch (error) {
    console.error("getDashboardStats error:", error);
    return {
      totalDishes: 0,
      availableDishes: 0,
      hiddenDishes: 0,
      activeCategories: 0,
      featuredItems: 0,
      totalMessages: 0,
      newMessages: 0,
      galleryPhotos: 0,
      vegetarianCount: 0,
      veganCount: 0,
      spicyCount: 0,
    };
  }
}

export async function getCategoryBreakdown() {
  try {
    return await db.category.findMany({
      where: { deletedAt: null },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        isActive: true,
        _count: {
          select: { dishes: { where: { deletedAt: null } } },
        },
      },
    });
  } catch (error) {
    console.error("getCategoryBreakdown error:", error);
    return [];
  }
}

export async function getRecentMessages(limit = 4) {
  try {
    return await db.contactMessage.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        subject: true,
        status: true,
        createdAt: true,
      },
    });
  } catch (error) {
    console.error("getRecentMessages error:", error);
    return [];
  }
}

export async function getRecentActivity(limit = 6) {
  try {
    return await db.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { actor: { select: { name: true } } },
    });
  } catch (error) {
    console.error("getRecentActivity error:", error);
    return [];
  }
}

export async function getRecentDishes(limit = 5) {
  try {
    return await db.dish.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        name: true,
        price: true,
        isAvailable: true,
        isFeatured: true,
        updatedAt: true,
        category: { select: { name: true } },
      },
    });
  } catch (error) {
    console.error("getRecentDishes error:", error);
    return [];
  }
}
