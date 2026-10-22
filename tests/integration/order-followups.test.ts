import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db/prisma";
import { createIngredient, upsertRecipeItem } from "@/lib/services/inventory";
import { createDish } from "@/lib/services/menu";
import { createOrder } from "@/lib/services/orders";
import { dishInput, makeCategory, truncateTables, uniqueSuffix } from "../helpers/db";

const tables = ["OutboxEvent", "LoyaltyLedger", "RecipeItem", "Ingredient", "OrderItem", "Order", "Dish", "Category"] as const;

beforeAll(() => truncateTables(...tables));
afterAll(() => truncateTables(...tables));

describe("post-order steps", () => {
  it("two simultaneous orders both reduce stock (no lost update)", async () => {
    const suffix = uniqueSuffix();
    const category = await makeCategory();
    const dish = await createDish(dishInput(category.id, { name: `Biryani ${suffix}` }));
    const rice = await createIngredient({ name: `Rice ${suffix}`, unit: "kg", currentStock: 10, parLevel: 1 });
    await upsertRecipeItem({ dishId: dish.id, ingredientId: rice.id, quantityRequired: 1 });

    const place = (n: number) =>
      createOrder({
        customerName: "Meera Sen",
        customerEmail: `meera-${n}-${suffix}@example.com`,
        customerPhone: "+91 98765 12345",
        diningMode: "TAKEAWAY",
        items: [{ dishId: dish.id, dishName: dish.name, quantity: 3, price: Number(dish.price) }],
      });
    await Promise.all([place(1), place(2)]);

    const after = await db.ingredient.findUniqueOrThrow({ where: { id: rice.id } });
    expect(Number(after.currentStock)).toBe(4);
  });
});
