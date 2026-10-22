import "server-only";

import { db } from "@/lib/db/prisma";
import { Prisma } from "@/lib/generated/prisma/client";

/** The transaction client of the extended `db`. */
type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

export interface IngredientInput {
  name: string;
  unit?: string;
  currentStock?: number;
  parLevel?: number;
  costPerUnit?: number;
  tenantId?: string;
}

export interface RecipeItemInput {
  dishId: string;
  ingredientId: string;
  quantityRequired: number;
}

/**
 * Fetch all ingredients with their stock levels and par alerts
 */
export async function getInventoryList(tenantId?: string) {
  const where: Prisma.IngredientWhereInput = tenantId ? { tenantId } : {};
  const ingredients = await db.ingredient.findMany({
    where,
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: { recipeItems: true },
      },
    },
  });

  return ingredients.map((ing) => ({
    id: ing.id,
    name: ing.name,
    unit: ing.unit,
    currentStock: Number(ing.currentStock),
    parLevel: Number(ing.parLevel),
    costPerUnit: ing.costPerUnit ? Number(ing.costPerUnit) : null,
    isLowStock: Number(ing.currentStock) <= Number(ing.parLevel),
    isOutOfStock: Number(ing.currentStock) <= 0,
    recipeCount: ing._count.recipeItems,
    updatedAt: ing.updatedAt,
  }));
}

/**
 * Create a new raw ingredient
 */
export async function createIngredient(data: IngredientInput) {
  return db.ingredient.create({
    data: {
      name: data.name.trim(),
      unit: data.unit?.trim() || "pcs",
      currentStock: new Prisma.Decimal(data.currentStock ?? 0),
      parLevel: new Prisma.Decimal(data.parLevel ?? 10),
      costPerUnit: data.costPerUnit != null ? new Prisma.Decimal(data.costPerUnit) : null,
      tenantId: data.tenantId || null,
    },
  });
}

/**
 * Update stock level directly or restock
 */
export async function restockIngredient(
  ingredientId: string,
  addQuantity: number
) {
  const ingredient = await db.ingredient.findUnique({
    where: { id: ingredientId },
  });

  if (!ingredient) {
    throw new Error("Ingredient not found");
  }

  const newStock = Math.max(0, Number(ingredient.currentStock) + addQuantity);

  const updated = await db.ingredient.update({
    where: { id: ingredientId },
    data: { currentStock: new Prisma.Decimal(newStock) },
  });

  // If restocked above zero, re-evaluate all dishes that require this ingredient
  // and restore availability if all their required ingredients are now > 0.
  if (newStock > 0) {
    await restoreDishesIfInStock(ingredientId);
  }

  return updated;
}

/**
 * Set exact stock for an ingredient
 */
export async function updateIngredientStock(
  ingredientId: string,
  exactStock: number
) {
  const updated = await db.ingredient.update({
    where: { id: ingredientId },
    data: { currentStock: new Prisma.Decimal(Math.max(0, exactStock)) },
  });

  if (exactStock <= 0) {
    await checkAndAuto86(ingredientId);
  } else {
    await restoreDishesIfInStock(ingredientId);
  }

  return updated;
}

/**
 * Link an ingredient to a dish recipe with required quantity
 */
export async function upsertRecipeItem(input: RecipeItemInput) {
  if (input.quantityRequired <= 0) {
    throw new Error("Quantity required must be greater than zero");
  }

  return db.recipeItem.upsert({
    where: {
      dishId_ingredientId: {
        dishId: input.dishId,
        ingredientId: input.ingredientId,
      },
    },
    create: {
      dishId: input.dishId,
      ingredientId: input.ingredientId,
      quantityRequired: new Prisma.Decimal(input.quantityRequired),
    },
    update: {
      quantityRequired: new Prisma.Decimal(input.quantityRequired),
    },
  });
}

/**
 * Remove an ingredient from a dish's recipe
 */
export async function deleteRecipeItem(dishId: string, ingredientId: string) {
  return db.recipeItem.delete({
    where: {
      dishId_ingredientId: {
        dishId,
        ingredientId,
      },
    },
  });
}

/**
 * Fetch recipe items for a given dish
 */
export async function getRecipeForDish(dishId: string) {
  return db.recipeItem.findMany({
    where: { dishId },
    include: {
      ingredient: true,
    },
  });
}

/**
 * Depletes inventory for all items in an order.
 * If any ingredient hits <= 0 stock, automatically 86's (marks isAvailable = false)
 * all dishes that require that ingredient!
 */
export async function depleteInventoryForOrder(orderId: string) {
  // All-or-nothing, so a failed attempt can be retried without double-counting.
  return db.$transaction((tx) => depleteInTransaction(tx, orderId));
}

async function depleteInTransaction(tx: Tx, orderId: string) {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
    },
  });

  if (!order || !order.items || order.items.length === 0) {
    return { depletedIngredients: [], auto86Dishes: [] };
  }

  const depletedIngredients: { id: string; name: string; remainingStock: number }[] = [];
  const auto86Dishes: { id: string; name: string }[] = [];

  // Group dish counts
  const dishQuantities = new Map<string, number>();
  for (const item of order.items) {
    if (item.dishId) {
      dishQuantities.set(
        item.dishId,
        (dishQuantities.get(item.dishId) || 0) + item.quantity
      );
    }
  }

  if (dishQuantities.size === 0) {
    return { depletedIngredients, auto86Dishes };
  }

  const dishIds = Array.from(dishQuantities.keys());
  const recipeItems = await tx.recipeItem.findMany({
    where: { dishId: { in: dishIds } },
    include: { ingredient: true },
  });

  // Calculate total depletion needed per ingredient
  const ingredientDepletion = new Map<string, { ingredient: typeof recipeItems[0]["ingredient"]; amount: number }>();

  for (const r of recipeItems) {
    const orderQty = dishQuantities.get(r.dishId) || 0;
    const required = Number(r.quantityRequired) * orderQty;
    const existing = ingredientDepletion.get(r.ingredientId);
    if (existing) {
      existing.amount += required;
    } else {
      ingredientDepletion.set(r.ingredientId, {
        ingredient: r.ingredient,
        amount: required,
      });
    }
  }

  // Apply depletions
  for (const [ingredientId, { ingredient, amount }] of ingredientDepletion.entries()) {
    // Atomic decrement: two orders at once cannot overwrite each other's stock.
    const after = await tx.ingredient.update({
      where: { id: ingredientId },
      data: { currentStock: { decrement: new Prisma.Decimal(amount) } },
    });
    let newStock = Number(after.currentStock);
    if (newStock < 0) {
      await tx.ingredient.update({ where: { id: ingredientId }, data: { currentStock: new Prisma.Decimal(0) } });
      newStock = 0;
    }

    depletedIngredients.push({
      id: ingredientId,
      name: ingredient.name,
      remainingStock: newStock,
    });

    // If ingredient drops to zero or below, auto-86 all dishes using this ingredient!
    if (newStock <= 0) {
      const affected86 = await checkAndAuto86(ingredientId, tx);
      auto86Dishes.push(...affected86);
    }
  }

  return { depletedIngredients, auto86Dishes };
}

/**
 * Check if ingredient is at or below 0 stock; if so, Auto-86 all dishes needing it
 */
export async function checkAndAuto86(ingredientId: string, client: Tx | typeof db = db) {
  const ingredient = await client.ingredient.findUnique({
    where: { id: ingredientId },
    include: {
      recipeItems: {
        include: {
          dish: true,
        },
      },
    },
  });

  if (!ingredient || Number(ingredient.currentStock) > 0) {
    return [];
  }

  const dishesTo86 = ingredient.recipeItems
    .map((r) => r.dish)
    .filter((dish) => dish && dish.isAvailable);

  if (dishesTo86.length === 0) {
    return [];
  }

  const dishIds = dishesTo86.map((d) => d.id);

  await client.dish.updateMany({
    where: { id: { in: dishIds } },
    data: { isAvailable: false },
  });

  return dishesTo86.map((d) => ({ id: d.id, name: d.name }));
}

/**
 * Check all dishes that rely on this ingredient.
 * If ALL required ingredients for a dish now have stock > 0, restore dish availability.
 */
export async function restoreDishesIfInStock(ingredientId: string) {
  const recipesWithThis = await db.recipeItem.findMany({
    where: { ingredientId },
    select: { dishId: true },
  });

  const dishIds = Array.from(new Set(recipesWithThis.map((r) => r.dishId)));
  if (dishIds.length === 0) return [];

  const restoredDishes: { id: string; name: string }[] = [];

  for (const dishId of dishIds) {
    // Check all recipe ingredients for this dish
    const allIngredients = await db.recipeItem.findMany({
      where: { dishId },
      include: { ingredient: true },
    });

    const allInStock = allIngredients.every(
      (r) => Number(r.ingredient.currentStock) > 0
    );

    if (allInStock && allIngredients.length > 0) {
      const dish = await db.dish.update({
        where: { id: dishId },
        data: { isAvailable: true },
        select: { id: true, name: true },
      });
      restoredDishes.push(dish);
    }
  }

  return restoredDishes;
}
