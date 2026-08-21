import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  unstable_cache: (fn: unknown) => fn,
}));

import { db } from "@/lib/db/prisma";
import {
  createDish,
  deleteCategory,
  deleteDish,
  getDishAdmin,
  hardDeleteDish,
  listDishesAdmin,
  reorderDishes,
  toggleDishAvailability,
  toggleDishFeatured,
  updateDish,
} from "@/lib/services/menu";
import { dishInput, makeCategory, truncateTables, uniqueSuffix } from "../helpers/db";

beforeAll(async () => {
  await truncateTables("ActivityLog", "Dish", "Category");
});

afterAll(async () => {
  await truncateTables("ActivityLog", "Dish", "Category");
});

describe("dish CRUD", () => {
  it("creates a dish with a slugified name and writes an audit log", async () => {
    const category = await makeCategory();
    const dish = await createDish({ ...dishInput(category.id, { name: `Butter Chicken ${uniqueSuffix()}` }) });

    expect(dish.slug).toMatch(/^butter-chicken-/);
    expect(Number(dish.price)).toBe(199);

    const log = await db.activityLog.findFirst({ where: { entityType: "DISH", entityId: dish.id } });
    expect(log?.action).toBe("CREATE");
  });

  it("generates unique slugs for duplicate dish names", async () => {
    const category = await makeCategory();
    const name = `Duplicate Dish ${uniqueSuffix()}`;

    const first = await createDish({ ...dishInput(category.id, { name }) });
    const second = await createDish({ ...dishInput(category.id, { name }) });

    expect(first.slug).not.toBe(second.slug);
    expect(second.slug.startsWith(first.slug)).toBe(true);
  });

  it("rejects an update whose slug collides with another dish", async () => {
    const category = await makeCategory();
    const base = `clash-${uniqueSuffix()}`;
    const first = await createDish({ ...dishInput(category.id), slug: base });
    const second = await createDish({ ...dishInput(category.id), slug: `${base}-two` });

    await expect(
      updateDish(second.id, { ...dishInput(category.id), slug: base })
    ).rejects.toThrow("SLUG_TAKEN");

    expect((await getDishAdmin(first.id))?.slug).toBe(base);
  });

  it("soft-deletes a dish and hides it from admin queries", async () => {
    const category = await makeCategory();
    const dish = await createDish({ ...dishInput(category.id) });

    await deleteDish(dish.id);

    const row = await db.dish.findUniqueOrThrow({ where: { id: dish.id } });
    expect(row.deletedAt).not.toBeNull();
    expect(await getDishAdmin(dish.id)).toBeNull();

    const listed = await listDishesAdmin({ search: row.name.split(" ")[0] });
    expect(listed.items.some((d) => d.id === dish.id)).toBe(false);
  });

  it("hard-deletes a dish row permanently", async () => {
    const category = await makeCategory();
    const dish = await createDish({ ...dishInput(category.id) });

    await hardDeleteDish(dish.id);
    expect(await db.dish.findUnique({ where: { id: dish.id } })).toBeNull();
  });

  it("toggles availability and featured state with audit entries", async () => {
    const category = await makeCategory();
    const dish = await createDish({ ...dishInput(category.id) });

    const unavailable = await toggleDishAvailability(dish.id, false);
    const featured = await toggleDishFeatured(dish.id, true);

    expect(unavailable.isAvailable).toBe(false);
    expect(featured.isFeatured).toBe(true);

    const actions = await db.activityLog.findMany({
      where: { entityType: "DISH", entityId: dish.id },
      select: { action: true },
    });
    const names = actions.map((a) => a.action);
    expect(names).toContain("UNPUBLISH");
    expect(names).toContain("FEATURE");
  });

  it("reorders dishes inside a transaction", async () => {
    const category = await makeCategory();
    const a = await createDish({ ...dishInput(category.id) });
    const b = await createDish({ ...dishInput(category.id) });

    await reorderDishes([
      { id: a.id, sortOrder: 40 },
      { id: b.id, sortOrder: 41 },
    ]);

    const [first, second] = await Promise.all([
      db.dish.findUniqueOrThrow({ where: { id: a.id } }),
      db.dish.findUniqueOrThrow({ where: { id: b.id } }),
    ]);
    expect([first.sortOrder, second.sortOrder]).toEqual([40, 41]);
  });

  it("refuses to reorder when any dish is missing", async () => {
    const category = await makeCategory();
    const dish = await createDish({ ...dishInput(category.id) });

    await expect(
      reorderDishes([
        { id: dish.id, sortOrder: 1 },
        { id: "00000000-0000-0000-0000-000000000000", sortOrder: 2 },
      ])
    ).rejects.toThrow("NOT_FOUND");
  });
});

describe("category deletion guard", () => {
  it("blocks deleting a category that still has dishes", async () => {
    const category = await makeCategory();
    await createDish({ ...dishInput(category.id) });

    await expect(deleteCategory(category.id)).rejects.toThrow("CATEGORY_NOT_EMPTY");
  });

  it("soft-deletes an empty category", async () => {
    const category = await makeCategory({ name: `Empty Cat ${uniqueSuffix()}` });
    await deleteCategory(category.id);

    const row = await db.category.findUniqueOrThrow({ where: { id: category.id } });
    expect(row.deletedAt).not.toBeNull();
  });
});
