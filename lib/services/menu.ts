import "server-only";

import { unstable_cache } from "next/cache";
import { db } from "@/lib/db/prisma";
import { ensureUniqueSlug, slugify } from "@/lib/utils/slugify";
import { logAction } from "@/lib/services/audit";
import { globalCache } from "@/lib/cache/cache-manager";
import { assertWithinPlan } from "@/lib/plans";
import { resolveTenant } from "@/lib/db/tenant";

// ---------------------------------------------------------------------------
// Public queries (cached with revalidation tag "menu")
// ---------------------------------------------------------------------------

export interface PublicDish {
  id: string;
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  price: number;
  compareAtPrice: number | null;
  image: string | null;
  isFeatured: boolean;
  isVegetarian: boolean;
  isVegan: boolean;
  isSpicy: boolean;
  containsNuts: boolean;
  preparationTime: number | null;
  calories: number | null;
  station?: string;
  modifierGroups?: PublicModifierGroup[];
}

export interface PublicModifierOption {
  id: string;
  name: string;
  priceDelta: number;
}

export interface PublicModifierGroup {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  options: PublicModifierOption[];
}

export interface PublicCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  sortOrder: number;
  dishes: PublicDish[];
}

type DishSelect = {
  id: string;
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  price: { toString(): string };
  compareAtPrice: { toString(): string } | null;
  image: string | null;
  isFeatured: boolean;
  isVegetarian: boolean;
  isVegan: boolean;
  isSpicy: boolean;
  containsNuts: boolean;
  preparationTime: number | null;
  calories: number | null;
  station?: string;
  modifierGroups?: {
    id: string;
    name: string;
    minSelect: number;
    maxSelect: number;
    options: {
      id: string;
      name: string;
      priceDelta: { toString(): string } | number;
    }[];
  }[];
};

function toPublicDish(dish: DishSelect): PublicDish {
  return {
    id: dish.id,
    name: dish.name,
    slug: dish.slug,
    shortDescription: dish.shortDescription,
    description: dish.description,
    price: Number(dish.price),
    compareAtPrice: dish.compareAtPrice === null ? null : Number(dish.compareAtPrice),
    image: dish.image,
    isFeatured: dish.isFeatured,
    isVegetarian: dish.isVegetarian,
    isVegan: dish.isVegan,
    isSpicy: dish.isSpicy,
    containsNuts: dish.containsNuts,
    preparationTime: dish.preparationTime,
    calories: dish.calories,
    station: dish.station || "HOT_KITCHEN",
    modifierGroups: (dish.modifierGroups || []).map((g) => ({
      id: g.id,
      name: g.name,
      minSelect: g.minSelect,
      maxSelect: g.maxSelect,
      options: g.options.map((o) => ({
        id: o.id,
        name: o.name,
        priceDelta: Number(o.priceDelta),
      })),
    })),
  };
}

async function fetchMenu(tenantId: string): Promise<PublicCategory[]> {
  try {
    const categories = await db.category.findMany({
      where: { tenantId, isActive: true, deletedAt: null },
      orderBy: { sortOrder: "asc" },
      include: {
        dishes: {
          where: { tenantId, isAvailable: true, deletedAt: null },
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            name: true,
            slug: true,
            shortDescription: true,
            description: true,
            price: true,
            compareAtPrice: true,
            image: true,
            isFeatured: true,
            isVegetarian: true,
            isVegan: true,
            isSpicy: true,
            containsNuts: true,
            preparationTime: true,
            calories: true,
            station: true,
            modifierGroups: {
              orderBy: { sortOrder: "asc" },
              include: {
                options: {
                  where: { isAvailable: true },
                  orderBy: { sortOrder: "asc" },
                },
              },
            },
          },
        },
      },
    });

    return categories.map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      image: category.image,
      sortOrder: category.sortOrder,
      dishes: category.dishes.map(toPublicDish),
    }));
  } catch (error) {
    console.error("fetchMenu: database query failed, returning fallback empty list", error);
    return [];
  }
}

export const getMenuCached = unstable_cache(fetchMenu, ["menu"], {
  tags: ["menu"],
  revalidate: 300,
});

export async function getMenu(tenantId?: string): Promise<PublicCategory[]> {
  return getMenuCached(tenantId ?? (await resolveTenant()).id);
}

export async function getDishBySlugCached(slug: string, tenantId?: string) {
  try {
    const scopedTenantId = tenantId ?? (await resolveTenant()).id;
    const dish = await db.dish.findFirst({
      where: { tenantId: scopedTenantId, slug, isAvailable: true, deletedAt: null },
      select: {
        id: true,
        name: true,
        slug: true,
        shortDescription: true,
        description: true,
        price: true,
        compareAtPrice: true,
        image: true,
        isFeatured: true,
        isVegetarian: true,
        isVegan: true,
        isSpicy: true,
        containsNuts: true,
        preparationTime: true,
        calories: true,
        station: true,
        category: { select: { name: true, slug: true } },
        modifierGroups: {
          orderBy: { sortOrder: "asc" },
          include: {
            options: {
              where: { isAvailable: true },
              orderBy: { sortOrder: "asc" },
            },
          },
        },
      },
    });

    if (!dish) return null;

    return {
      id: dish.id,
      name: dish.name,
      slug: dish.slug,
      shortDescription: dish.shortDescription,
      description: dish.description,
      price: Number(dish.price),
      compareAtPrice: dish.compareAtPrice === null ? null : Number(dish.compareAtPrice),
      image: dish.image,
      isFeatured: dish.isFeatured,
      isVegetarian: dish.isVegetarian,
      isVegan: dish.isVegan,
      isSpicy: dish.isSpicy,
      containsNuts: dish.containsNuts,
      preparationTime: dish.preparationTime,
      calories: dish.calories,
      station: dish.station || "HOT_KITCHEN",
      categoryName: dish.category.name,
      categorySlug: dish.category.slug,
      modifierGroups: (dish.modifierGroups || []).map((g) => ({
        id: g.id,
        name: g.name,
        minSelect: g.minSelect,
        maxSelect: g.maxSelect,
        options: g.options.map((o) => ({
          id: o.id,
          name: o.name,
          priceDelta: Number(o.priceDelta),
        })),
      })),
    };
  } catch (error) {
    console.error("getDishBySlug: database query failed", error);
    return null;
  }
}

export async function getRelatedDishes(
  categorySlug: string,
  currentSlug: string,
  limit = 3,
  tenantId?: string
): Promise<PublicDish[]> {
  try {
    const scopedTenantId = tenantId ?? (await resolveTenant()).id;
    const category = await db.category.findFirst({
      where: { tenantId: scopedTenantId, slug: categorySlug, isActive: true, deletedAt: null },
      include: {
        dishes: {
          where: {
            slug: { not: currentSlug },
            isAvailable: true,
            deletedAt: null,
          },
          orderBy: { isFeatured: "desc" },
          take: limit,
          select: {
            id: true,
            name: true,
            slug: true,
            shortDescription: true,
            description: true,
            price: true,
            compareAtPrice: true,
            image: true,
            isFeatured: true,
            isVegetarian: true,
            isVegan: true,
            isSpicy: true,
            containsNuts: true,
            preparationTime: true,
            calories: true,
          },
        },
      },
    });

    if (!category) return [];
    return category.dishes.map(toPublicDish);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Admin queries (always fresh)
// ---------------------------------------------------------------------------

export async function listCategoriesAdmin(tenantId: string) {
  try {
    return await db.category.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { sortOrder: "asc" },
      include: {
        _count: { select: { dishes: { where: { deletedAt: null } } } },
      },
    });
  } catch {
    return [];
  }
}

export async function listDishesAdmin(input: {
  tenantId: string;
  search?: string;
  category?: string;
  featured?: string;
  available?: string;
  sort?: string;
  dir?: string;
  page?: number;
  pageSize?: number;
}) {
  const where = {
    tenantId: input.tenantId,
    deletedAt: null,
    ...(input.search ? { name: { contains: input.search, mode: "insensitive" as const } } : {}),
    ...(input.category ? { categoryId: input.category } : {}),
    ...(input.featured === "true" ? { isFeatured: true } : input.featured === "false" ? { isFeatured: false } : {}),
    ...(input.available === "true" ? { isAvailable: true } : input.available === "false" ? { isAvailable: false } : {}),
  };

  const sortField =
    input.sort === "name" || input.sort === "price" || input.sort === "createdAt" || input.sort === "sortOrder"
      ? input.sort
      : "sortOrder";
  const orderBy = { [sortField]: input.dir === "desc" ? ("desc" as const) : ("asc" as const) };

  const [total, items] = await Promise.all([
    db.dish.count({ where }),
    db.dish.findMany({
      where,
      orderBy,
      include: { category: { select: { name: true } } },
      skip: ((input.page ?? 1) - 1) * (input.pageSize ?? 50),
      take: input.pageSize ?? 50,
    }),
  ]);

  return { total, items };
}

export async function getDishAdmin(id: string) {
  return db.dish.findFirst({ where: { id, deletedAt: null } });
}

// ---------------------------------------------------------------------------
// Admin mutations
// ---------------------------------------------------------------------------

export async function invalidateMenuCaches(): Promise<void> {
  try {
    await globalCache.deleteByPrefix("api:menu");
  } catch (err) {
    console.warn("[MenuService] Cache invalidation warning:", err);
  }
}

export async function createCategory(input: {
  tenantId: string;
  name: string;
  slug?: string;
  description?: string | null;
  image?: string | null;
  isActive: boolean;
  sortOrder: number;
  actorId?: string | null;
}) {
  const slug = await uniqueSlug("category", input.tenantId, input.slug ? slugify(input.slug) : slugify(input.name));

  const category = await db.category.create({
    data: {
      tenantId: input.tenantId,
      name: input.name,
      slug,
      description: input.description || null,
      image: input.image || null,
      isActive: input.isActive,
      sortOrder: input.sortOrder,
    },
  });

  await logAction({
    actorId: input.actorId,
    action: "CREATE",
    entityType: "CATEGORY",
    entityId: category.id,
    metadata: { name: category.name },
  });

  await invalidateMenuCaches();
  return category;
}

export async function updateCategory(
  id: string,
  input: {
    name: string;
    slug?: string;
    description?: string | null;
    image?: string | null;
    isActive: boolean;
    sortOrder: number;
    actorId?: string | null;
  }
) {
  const existing = await db.category.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw new Error("NOT_FOUND");

  const slug = input.slug ? slugify(input.slug) : slugify(input.name);
  await ensureSlugUnique("category", existing.tenantId, slug, id);

  const category = await db.category.update({
    where: { id },
    data: {
      name: input.name,
      slug,
      description: input.description || null,
      image: input.image || null,
      isActive: input.isActive,
      sortOrder: input.sortOrder,
    },
  });

  await logAction({
    actorId: input.actorId,
    action: "UPDATE",
    entityType: "CATEGORY",
    entityId: category.id,
    metadata: { name: category.name },
  });

  await invalidateMenuCaches();
  return category;
}

export async function deleteCategory(id: string, actorId?: string | null) {
  const existing = await db.category.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw new Error("NOT_FOUND");

  const dishCount = await db.dish.count({ where: { categoryId: id, deletedAt: null } });
  if (dishCount > 0) throw new Error("CATEGORY_NOT_EMPTY");

  // Soft delete via unique slug is tricky; keep unique constraint intact.
  await db.category.update({
    where: { id },
    data: { deletedAt: new Date(), slug: `${existing.slug}--deleted-${Date.now()}` },
  });

  await logAction({
    actorId,
    action: "DELETE",
    entityType: "CATEGORY",
    entityId: id,
    metadata: { name: existing.name },
  });

  await invalidateMenuCaches();
}

export async function createDish(
  input: {
    tenantId: string;
    name: string;
    slug?: string;
    categoryId: string;
    shortDescription: string;
    description: string;
    price: number;
    compareAtPrice?: number | null;
    image?: string | null;
    isFeatured: boolean;
    isAvailable: boolean;
    isVegetarian: boolean;
    isVegan: boolean;
    isSpicy: boolean;
    containsNuts: boolean;
    preparationTime?: number | null;
    calories?: number | null;
    sortOrder: number;
    actorId?: string | null;
  }
) {
  const slug = await uniqueSlug("dish", input.tenantId, input.slug ? slugify(input.slug) : slugify(input.name));

  await assertWithinPlan(input.tenantId, "dishes");

  const dish = await db.dish.create({
    data: {
      tenantId: input.tenantId,
      name: input.name,
      slug,
      categoryId: input.categoryId,
      shortDescription: input.shortDescription,
      description: input.description,
      price: input.price,
      compareAtPrice: input.compareAtPrice ?? null,
      image: input.image || null,
      isFeatured: input.isFeatured,
      isAvailable: input.isAvailable,
      isVegetarian: input.isVegetarian,
      isVegan: input.isVegan,
      isSpicy: input.isSpicy,
      containsNuts: input.containsNuts,
      preparationTime: input.preparationTime ?? null,
      calories: input.calories ?? null,
      sortOrder: input.sortOrder,
    },
  });

  await logAction({
    actorId: input.actorId,
    action: "CREATE",
    entityType: "DISH",
    entityId: dish.id,
    metadata: { name: dish.name, price: Number(dish.price) },
  });

  await invalidateMenuCaches();
  return dish;
}

export async function updateDish(
  id: string,
  input: {
    name: string;
    slug?: string;
    categoryId: string;
    shortDescription: string;
    description: string;
    price: number;
    compareAtPrice?: number | null;
    image?: string | null;
    isFeatured: boolean;
    isAvailable: boolean;
    isVegetarian: boolean;
    isVegan: boolean;
    isSpicy: boolean;
    containsNuts: boolean;
    preparationTime?: number | null;
    calories?: number | null;
    sortOrder: number;
    actorId?: string | null;
  }
) {
  const existing = await db.dish.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw new Error("NOT_FOUND");

  const slug = input.slug ? slugify(input.slug) : slugify(input.name);
  await ensureSlugUnique("dish", existing.tenantId, slug, id);

  const dish = await db.dish.update({
    where: { id },
    data: {
      name: input.name,
      slug,
      categoryId: input.categoryId,
      shortDescription: input.shortDescription,
      description: input.description,
      price: input.price,
      compareAtPrice: input.compareAtPrice ?? null,
      image: input.image || null,
      isFeatured: input.isFeatured,
      isAvailable: input.isAvailable,
      isVegetarian: input.isVegetarian,
      isVegan: input.isVegan,
      isSpicy: input.isSpicy,
      containsNuts: input.containsNuts,
      preparationTime: input.preparationTime ?? null,
      calories: input.calories ?? null,
      sortOrder: input.sortOrder,
    },
  });

  await logAction({
    actorId: input.actorId,
    action: "UPDATE",
    entityType: "DISH",
    entityId: dish.id,
    metadata: { name: dish.name },
  });

  await invalidateMenuCaches();
  return dish;
}

export async function deleteDish(id: string, actorId?: string | null) {
  const existing = await db.dish.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw new Error("NOT_FOUND");

  await db.dish.update({
    where: { id },
    data: { deletedAt: new Date(), slug: `${existing.slug}--deleted-${Date.now()}` },
  });

  await logAction({
    actorId,
    action: "DELETE",
    entityType: "DISH",
    entityId: id,
    metadata: { name: existing.name },
  });

  await invalidateMenuCaches();
}

export async function hardDeleteDish(id: string, actorId?: string | null) {
  const existing = await db.dish.findUnique({ where: { id } });
  if (!existing) throw new Error("NOT_FOUND");

  await db.dish.delete({ where: { id } });

  await logAction({
    actorId,
    action: "DELETE",
    entityType: "DISH",
    entityId: id,
    metadata: { name: existing.name, hard: true },
  });

  await invalidateMenuCaches();
}

export async function toggleDishAvailability(id: string, isAvailable: boolean, actorId?: string | null) {
  const existing = await db.dish.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw new Error("NOT_FOUND");

  const dish = await db.dish.update({ where: { id }, data: { isAvailable } });

  await logAction({
    actorId,
    action: isAvailable ? "PUBLISH" : "UNPUBLISH",
    entityType: "DISH",
    entityId: id,
    metadata: { name: dish.name },
  });

  await invalidateMenuCaches();
  return dish;
}

export async function toggleDishFeatured(id: string, isFeatured: boolean, actorId?: string | null) {
  const existing = await db.dish.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw new Error("NOT_FOUND");

  const dish = await db.dish.update({ where: { id }, data: { isFeatured } });

  await logAction({
    actorId,
    action: "FEATURE",
    entityType: "DISH",
    entityId: id,
    metadata: { name: dish.name, isFeatured },
  });

  await invalidateMenuCaches();
  return dish;
}

export async function reorderDishes(items: { id: string; sortOrder: number }[], actorId?: string | null) {
  const ids = items.map((i) => i.id);
  const existing = await db.dish.findMany({ where: { id: { in: ids }, deletedAt: null } });
  if (existing.length !== items.length) throw new Error("NOT_FOUND");

  await db.$transaction(
    items.map((item) => db.dish.update({ where: { id: item.id }, data: { sortOrder: item.sortOrder } }))
  );

  await logAction({
    actorId,
    action: "UPDATE",
    entityType: "DISH",
    entityId: null,
    metadata: { reordered: items.length },
  });

  await invalidateMenuCaches();
}

// ---------------------------------------------------------------------------
// Slug helpers
// ---------------------------------------------------------------------------

async function uniqueSlug(model: "dish" | "category", tenantId: string, base: string) {
  const existing = await getExistingSlugs(model, tenantId, base);
  return ensureUniqueSlug(base, existing);
}

async function ensureSlugUnique(
  model: "dish" | "category",
  tenantId: string,
  slug: string,
  excludeId: string
) {
  const where = { tenantId, slug, id: { not: excludeId }, deletedAt: null };
  const clash =
    model === "dish"
      ? await db.dish.findFirst({ where })
      : await db.category.findFirst({ where });
  if (clash) {
    throw new Error("SLUG_TAKEN");
  }
}

async function getExistingSlugs(
  model: "dish" | "category",
  tenantId: string,
  prefix: string
): Promise<string[]> {
  const where = { tenantId, slug: { startsWith: prefix }, deletedAt: null };
  const select = { slug: true } as const;
  const rows =
    model === "dish"
      ? await db.dish.findMany({ where, select })
      : await db.category.findMany({ where, select });
  return rows.map((r) => r.slug);
}
// ---------------------------------------------------------------------------
// Shared S2S menu catalog (used by BOTH the Next route and the Express adapter)
// ---------------------------------------------------------------------------

const API_MENU_TTL_SECONDS = 300;

/**
 * Tenant-scoped menu catalog for B2B consumers, cache-aside with a 5 minute TTL.
 * Cached under `api:menu:*`, which `invalidateMenuCaches` clears on every CMS
 * write. Prices are plain numbers so the JSON shape is identical whether the
 * value came from the database or from the cache.
 */
export async function getApiMenuCatalog(tenantId: string) {
  return globalCache.getOrSet(
    `api:menu:v2:${tenantId}`,
    async () => {
      const categories = await db.category.findMany({
        where: {
          isActive: true,
          deletedAt: null,
          tenantId,
        },
        orderBy: { sortOrder: "asc" },
        include: {
          dishes: {
            where: {
              isAvailable: true,
              deletedAt: null,
              tenantId,
            },
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              name: true,
              slug: true,
              shortDescription: true,
              description: true,
              price: true,
              compareAtPrice: true,
              image: true,
              isFeatured: true,
              isAvailable: true,
              isVegetarian: true,
              isVegan: true,
              isSpicy: true,
              containsNuts: true,
              preparationTime: true,
              calories: true,
            },
          },
        },
      });

      return categories.map((category) => ({
        ...category,
        dishes: category.dishes.map((dish) => ({
          ...dish,
          price: Number(dish.price),
          compareAtPrice: dish.compareAtPrice === null ? null : Number(dish.compareAtPrice),
        })),
      }));
    },
    API_MENU_TTL_SECONDS
  );
}
