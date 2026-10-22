import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/guards";
import { hasPermission, permissions } from "@/config/roles";
import { getInventoryList } from "@/lib/services/inventory";
import { db } from "@/lib/db/prisma";
import { InventoryManager } from "@/components/admin/inventory-manager";

export const metadata: Metadata = { title: "Inventory & Auto-86" };

export const dynamic = "force-dynamic";

export default async function AdminInventoryPage() {
  const admin = await requirePermission(permissions.VIEW_MENU);

  const [rawIngredients, rawDishes] = await Promise.all([
    getInventoryList(),
    db.dish.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, isAvailable: true, station: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const ingredients = rawIngredients.map((ing) => ({
    id: ing.id,
    name: ing.name,
    unit: ing.unit,
    currentStock: ing.currentStock,
    parLevel: ing.parLevel,
    costPerUnit: ing.costPerUnit,
    isLowStock: ing.isLowStock,
    isOutOfStock: ing.isOutOfStock,
    recipeCount: ing.recipeCount,
    updatedAt: ing.updatedAt,
  }));

  const dishes = rawDishes.map((d) => ({
    id: d.id,
    name: d.name,
    isAvailable: d.isAvailable,
    station: d.station,
  }));

  return (
    <InventoryManager
      initialIngredients={ingredients}
      dishes={dishes}
      canEdit={hasPermission(admin.role, permissions.EDIT_MENU)}
    />
  );
}
