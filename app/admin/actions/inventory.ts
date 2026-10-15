"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/guards";
import { permissions } from "@/config/roles";
import {
  createIngredient,
  restockIngredient,
  updateIngredientStock,
  upsertRecipeItem,
  deleteRecipeItem,
} from "@/lib/services/inventory";

export interface ActionState {
  ok: boolean;
  error?: string;
}

export async function adminCreateIngredientAction(formData: FormData): Promise<ActionState> {
  await requirePermission(permissions.EDIT_MENU);

  try {
    const name = String(formData.get("name") || "").trim();
    const unit = String(formData.get("unit") || "pcs").trim();
    const currentStock = Number(formData.get("currentStock") || 0);
    const parLevel = Number(formData.get("parLevel") || 10);
    const costPerUnit = formData.get("costPerUnit") ? Number(formData.get("costPerUnit")) : undefined;

    if (!name) {
      return { ok: false, error: "Ingredient name is required" };
    }

    await createIngredient({
      name,
      unit,
      currentStock,
      parLevel,
      costPerUnit,
    });

    revalidatePath("/admin/inventory");
    revalidatePath("/admin/menu");
    return { ok: true };
  } catch (err: unknown) {
    console.error("adminCreateIngredientAction error:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Failed to create ingredient" };
  }
}

export async function adminRestockIngredientAction(formData: FormData): Promise<ActionState> {
  await requirePermission(permissions.EDIT_MENU);

  try {
    const ingredientId = String(formData.get("ingredientId") || "");
    const addQuantity = Number(formData.get("addQuantity") || 0);

    if (!ingredientId || addQuantity <= 0) {
      return { ok: false, error: "Invalid restock quantity" };
    }

    await restockIngredient(ingredientId, addQuantity);
    revalidatePath("/admin/inventory");
    revalidatePath("/admin/menu");
    revalidatePath("/menu");
    return { ok: true };
  } catch (err: unknown) {
    console.error("adminRestockIngredientAction error:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Failed to restock" };
  }
}

export async function adminUpdateStockAction(formData: FormData): Promise<ActionState> {
  await requirePermission(permissions.EDIT_MENU);

  try {
    const ingredientId = String(formData.get("ingredientId") || "");
    const exactStock = Number(formData.get("exactStock") || 0);

    if (!ingredientId || exactStock < 0) {
      return { ok: false, error: "Invalid stock value" };
    }

    await updateIngredientStock(ingredientId, exactStock);
    revalidatePath("/admin/inventory");
    revalidatePath("/admin/menu");
    revalidatePath("/menu");
    return { ok: true };
  } catch (err: unknown) {
    console.error("adminUpdateStockAction error:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Failed to update stock" };
  }
}

export async function adminUpsertRecipeItemAction(formData: FormData): Promise<ActionState> {
  await requirePermission(permissions.EDIT_MENU);

  try {
    const dishId = String(formData.get("dishId") || "");
    const ingredientId = String(formData.get("ingredientId") || "");
    const quantityRequired = Number(formData.get("quantityRequired") || 1);

    if (!dishId || !ingredientId || quantityRequired <= 0) {
      return { ok: false, error: "Invalid recipe item data" };
    }

    await upsertRecipeItem({ dishId, ingredientId, quantityRequired });
    revalidatePath("/admin/inventory");
    revalidatePath("/admin/menu");
    return { ok: true };
  } catch (err: unknown) {
    console.error("adminUpsertRecipeItemAction error:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Failed to save recipe item" };
  }
}

export async function adminDeleteRecipeItemAction(
  dishId: string,
  ingredientId: string
): Promise<ActionState> {
  await requirePermission(permissions.EDIT_MENU);

  try {
    await deleteRecipeItem(dishId, ingredientId);
    revalidatePath("/admin/inventory");
    revalidatePath("/admin/menu");
    return { ok: true };
  } catch (err: unknown) {
    console.error("adminDeleteRecipeItemAction error:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Failed to delete recipe item" };
  }
}
