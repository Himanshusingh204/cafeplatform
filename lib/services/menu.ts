import "server-only";

import { unstable_cache } from "next/cache";
import { db } from "@/lib/db/prisma";
import { ensureUniqueSlug, slugify } from "@/lib/utils/slugify";
import { logAction } from "@/lib/services/audit";

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
  };
}

async function fetchMenu(): Promise<PublicCategory[]> {
  try {
    const categories = await db.category.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: { sortOrder: "asc" },
      include: {
        dishes: {
          where: { isAvailable: true, deletedAt: null },
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

export async function getMenu(): Promise<PublicCategory[]> {
  return getMenuCached();
}

export async function getDishBySlugCached(slug: string) {
  try {
    const dish = await db.dish.findFirst({
      where: { slug, isAvailable: true, deletedAt: null },
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
        category: { select: { name: true, slug: true } },
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
      categoryName: dish.category.name,
      categorySlug: dish.category.slug,
    };
  } catch (error) {
    console.error("getDishBySlug: database query failed", error);
    return null;
  }
}

export async function getRelatedDishes(categorySlug: string, currentSlug: string, limit = 3): Promise<PublicDish[]> {
  try {
    const category = await db.category.findUnique({
      where: { slug: categorySlug, isActive: true, deletedAt: null },
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

export async function listCategoriesAdmin() {
  try {
    return await db.category.findMany({
      where: { deletedAt: null },
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

export async function createCategory(input: {
  name: string;
  slug?: string;
  description?: string | null;
  image?: string | null;
  isActive: boolean;
  sortOrder: number;
  actorId?: string | null;
}) {
  const slug = await uniqueSlug("category", input.slug ? slugify(input.slug) : slugify(input.name));

  const category = await db.category.create({
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
    action: "CREATE",
    entityType: "CATEGORY",
    entityId: category.id,
    metadata: { name: category.name },
  });

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
  await ensureSlugUnique("category", slug, id);

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
}

export async function createDish(
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
  const slug = await uniqueSlug("dish", input.slug ? slugify(input.slug) : slugify(input.name));

  const dish = await db.dish.create({
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
    action: "CREATE",
    entityType: "DISH",
    entityId: dish.id,
    metadata: { name: dish.name, price: Number(dish.price) },
  });

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
  await ensureSlugUnique("dish", slug, id);

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
}

// ---------------------------------------------------------------------------
// Slug helpers
// ---------------------------------------------------------------------------

async function uniqueSlug(model: "dish" | "category", base: string) {
  const existing = await getExistingSlugs(model, base);
  return ensureUniqueSlug(base, existing);
}

async function ensureSlugUnique(model: "dish" | "category", slug: string, excludeId: string) {
  const where = { slug, id: { not: excludeId }, deletedAt: null };
  const clash =
    model === "dish"
      ? await db.dish.findFirst({ where })
      : await db.category.findFirst({ where });
  if (clash) {
    throw new Error("SLUG_TAKEN");
  }
}

async function getExistingSlugs(model: "dish" | "category", prefix: string): Promise<string[]> {
  const where = { slug: { startsWith: prefix }, deletedAt: null };
  const select = { slug: true } as const;
  const rows =
    model === "dish"
      ? await db.dish.findMany({ where, select })
      : await db.category.findMany({ where, select });
  return rows.map((r) => r.slug);
}