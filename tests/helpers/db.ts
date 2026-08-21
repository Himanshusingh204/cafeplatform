import { randomUUID } from "node:crypto";

import { db } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/passwords";

const TRUNCATABLE_TABLES = new Set([
  "Admin",
  "Session",
  "Category",
  "Dish",
  "GalleryImage",
  "ContactMessage",
  "ActivityLog",
  "Setting",
]);

// Test database only; names are validated against an allow-list.
export async function truncateTables(...names: string[]) {
  for (const name of names) {
    if (!TRUNCATABLE_TABLES.has(name)) {
      throw new Error(`Refusing to truncate unknown table: ${name}`);
    }
  }
  const list = names.map((name) => `"${name}"`).join(", ");
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${list} CASCADE`);
}

export function uniqueSuffix(): string {
  return randomUUID().replaceAll("-", "").slice(0, 10);
}

export async function makeAdmin(overrides: Partial<{ email: string; role: "SUPER_ADMIN" | "ADMIN" | "EDITOR"; isActive: boolean }> = {}) {
  return db.admin.create({
    data: {
      email: overrides.email ?? `admin-${uniqueSuffix()}@test.example`,
      passwordHash: await hashPassword("TestPass123!"),
      name: "Test Admin",
      role: overrides.role ?? "SUPER_ADMIN",
      isActive: overrides.isActive ?? true,
    },
  });
}

export async function makeCategory(overrides: Partial<{ name: string; slug: string; isActive: boolean }> = {}) {
  const suffix = uniqueSuffix();
  return db.category.create({
    data: {
      name: overrides.name ?? `Test Category ${suffix}`,
      slug: overrides.slug ?? `test-category-${suffix}`,
      isActive: overrides.isActive ?? true,
      sortOrder: 0,
    },
  });
}

export interface DishOverrides {
  name?: string;
  slug?: string;
  categoryId?: string;
  price?: number;
  isFeatured?: boolean;
  isAvailable?: boolean;
}

export function dishInput(categoryId: string, overrides: DishOverrides = {}) {
  const suffix = uniqueSuffix();
  return {
    name: overrides.name ?? `Test Dish ${suffix}`,
    categoryId,
    shortDescription: "A short test description.",
    description: "A longer test description used by the integration suite.",
    price: overrides.price ?? 199,
    isFeatured: overrides.isFeatured ?? false,
    isAvailable: overrides.isAvailable ?? true,
    isVegetarian: true,
    isVegan: false,
    isSpicy: false,
    containsNuts: false,
    sortOrder: 0,
  };
}
