import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db/prisma";
import {
  createIngredient,
  restockIngredient,
  upsertRecipeItem,
  checkAndAuto86,
  getInventoryList,
} from "@/lib/services/inventory";
import { createDish } from "@/lib/services/menu";
import { createOrder } from "@/lib/services/orders";
import { dishInput, makeCategory, truncateTables, uniqueSuffix } from "../helpers/db";

beforeAll(async () => {
  await truncateTables(
    "RecipeItem",
    "Ingredient",
    "OrderItem",
    "Order",
    "Dish",
    "Category"
  );
});

afterAll(async () => {
  await truncateTables(
    "RecipeItem",
    "Ingredient",
    "OrderItem",
    "Order",
    "Dish",
    "Category"
  );
});

describe("Inventory & Recipe Depletion (Auto-86) Engine", () => {
  it("creates an ingredient with par level and tracks stock", async () => {
    const suffix = uniqueSuffix();
    const ing = await createIngredient({
      name: `Paneer ${suffix}`,
      unit: "kg",
      currentStock: 15,
      parLevel: 5,
      costPerUnit: 350,
    });

    expect(ing.name).toContain("Paneer");
    expect(Number(ing.currentStock)).toBe(15);
    expect(Number(ing.parLevel)).toBe(5);

    const list = await getInventoryList();
    const found = list.find((i) => i.id === ing.id);
    expect(found).toBeDefined();
    expect(found?.isLowStock).toBe(false);
    expect(found?.isOutOfStock).toBe(false);
  });

  it("links ingredients to dish recipe with required quantities", async () => {
    const category = await makeCategory();
    const suffix = uniqueSuffix();
    const dish = await createDish(
      dishInput(category.id, { name: `Paneer Tikka ${suffix}` })
    );

    const ing = await createIngredient({
      name: `Fresh Cream ${suffix}`,
      unit: "l",
      currentStock: 10,
      parLevel: 2,
    });

    const recipeItem = await upsertRecipeItem({
      dishId: dish.id,
      ingredientId: ing.id,
      quantityRequired: 0.5,
    });

    expect(recipeItem.dishId).toBe(dish.id);
    expect(Number(recipeItem.quantityRequired)).toBe(0.5);
  });

  it("automatically depletes inventory and Auto-86s dishes when stock hits 0", async () => {
    const category = await makeCategory();
    const suffix = uniqueSuffix();
    const dish = await createDish(
      dishInput(category.id, { name: `Saffron Biryani ${suffix}` })
    );

    const ing = await createIngredient({
      name: `Pure Saffron ${suffix}`,
      unit: "g",
      currentStock: 2, // Only 2 grams available
      parLevel: 5,
    });

    await upsertRecipeItem({
      dishId: dish.id,
      ingredientId: ing.id,
      quantityRequired: 1, // 1g per biryani
    });

    expect(dish.isAvailable).toBe(true);

    // Create an order for 2 portions of biryani
    await createOrder({
      customerName: "Rohan Kapoor",
      customerEmail: `rohan-${suffix}@example.com`,
      customerPhone: "+91 98765 12345",
      diningMode: "TAKEAWAY",
      items: [
        {
          dishId: dish.id,
          dishName: dish.name,
          quantity: 2,
          price: Number(dish.price),
        },
      ],
    });

    // Verify stock was depleted: 2 - (1 * 2) = 0
    const updatedIng = await db.ingredient.findUnique({
      where: { id: ing.id },
    });
    expect(Number(updatedIng?.currentStock)).toBe(0);

    // Verify Auto-86 took effect on the dish!
    const updatedDish = await db.dish.findUnique({
      where: { id: dish.id },
    });
    expect(updatedDish?.isAvailable).toBe(false);
  });

  it("restores dish availability automatically when ingredient is restocked", async () => {
    const category = await makeCategory();
    const suffix = uniqueSuffix();
    const dish = await createDish(
      dishInput(category.id, { name: `Malai Kofta ${suffix}` })
    );

    const ing = await createIngredient({
      name: `Kaju Paste ${suffix}`,
      unit: "kg",
      currentStock: 0,
      parLevel: 2,
    });

    await upsertRecipeItem({
      dishId: dish.id,
      ingredientId: ing.id,
      quantityRequired: 0.2,
    });

    // Auto-86 since stock is 0
    await checkAndAuto86(ing.id);

    let checkDish = await db.dish.findUnique({ where: { id: dish.id } });
    expect(checkDish?.isAvailable).toBe(false);

    // Restock the ingredient with 5kg
    await restockIngredient(ing.id, 5);

    // Dish availability should now be automatically restored to true!
    checkDish = await db.dish.findUnique({ where: { id: dish.id } });
    expect(checkDish?.isAvailable).toBe(true);
  });
});
