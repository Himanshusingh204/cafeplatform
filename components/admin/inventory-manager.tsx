"use client";

import { useState, useTransition } from "react";
import {
  adminCreateIngredientAction,
  adminRestockIngredientAction,
  adminUpdateStockAction,
} from "@/app/admin/actions/inventory";
import { Plus, RefreshCw, AlertTriangle, AlertOctagon, CheckCircle2, Search } from "lucide-react";

export interface InventoryItem {
  id: string;
  name: string;
  unit: string;
  currentStock: number;
  parLevel: number;
  costPerUnit: number | null;
  isLowStock: boolean;
  isOutOfStock: boolean;
  recipeCount: number;
  updatedAt: Date | string;
}

export interface DishOption {
  id: string;
  name: string;
  isAvailable: boolean;
  station: string;
}

interface InventoryManagerProps {
  initialIngredients: InventoryItem[];
  dishes: DishOption[];
}

export function InventoryManager({ initialIngredients }: InventoryManagerProps) {
  const [ingredients, setIngredients] = useState<InventoryItem[]>(initialIngredients);
  const [search, setSearch] = useState("");
  const [filterLow, setFilterLow] = useState(false);
  const [restockModalItem, setRestockModalItem] = useState<InventoryItem | null>(null);
  const [restockQty, setRestockQty] = useState<string>("10");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = ingredients.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
    if (filterLow) {
      return matchesSearch && (item.isLowStock || item.isOutOfStock);
    }
    return matchesSearch;
  });

  const lowStockCount = ingredients.filter((i) => i.isLowStock && !i.isOutOfStock).length;
  const outOfStockCount = ingredients.filter((i) => i.isOutOfStock).length;

  const handleRestockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockModalItem) return;
    const addVal = Number(restockQty);
    if (isNaN(addVal) || addVal <= 0) return;

    setErrorMsg(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.append("ingredientId", restockModalItem.id);
      fd.append("addQuantity", String(addVal));

      const res = await adminRestockIngredientAction(fd);
      if (res.ok) {
        setIngredients((prev) =>
          prev.map((item) => {
            if (item.id !== restockModalItem.id) return item;
            const newStock = item.currentStock + addVal;
            return {
              ...item,
              currentStock: newStock,
              isOutOfStock: newStock <= 0,
              isLowStock: newStock <= item.parLevel,
            };
          })
        );
        setRestockModalItem(null);
      } else {
        setErrorMsg(res.error || "Failed to restock");
      }
    });
  };

  const handleQuickZero = (item: InventoryItem) => {
    if (!confirm(`Simulate depletion of "${item.name}" to 0? This will trigger Auto-86 on linked dishes!`)) {
      return;
    }

    startTransition(async () => {
      const fd = new FormData();
      fd.append("ingredientId", item.id);
      fd.append("exactStock", "0");

      const res = await adminUpdateStockAction(fd);
      if (res.ok) {
        setIngredients((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? { ...i, currentStock: 0, isOutOfStock: true, isLowStock: true }
              : i
          )
        );
      }
    });
  };

  const handleCreateSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);

    setErrorMsg(null);
    startTransition(async () => {
      const res = await adminCreateIngredientAction(fd);
      if (res.ok) {
        setIsAddOpen(false);
        window.location.reload();
      } else {
        setErrorMsg(res.error || "Failed to create ingredient");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header & Metric Cards */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-serif text-foreground">
            Inventory & Recipe Auto-86 Engine
          </h1>
          <p className="text-sm text-muted-foreground">
            Monitor raw ingredient levels, par alerts, and automatic menu dish 86&apos;ing.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsAddOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add Raw Ingredient
        </button>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium">
          {errorMsg}
        </div>
      )}

      {/* KPI Counters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-card border border-border flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">
            {ingredients.length}
          </div>
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase">Tracked Items</div>
            <div className="text-lg font-bold text-foreground">Total Ingredients</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-amber-500/30 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold text-lg">
            {lowStockCount}
          </div>
          <div>
            <div className="text-xs font-semibold text-amber-500 uppercase">Below Par Level</div>
            <div className="text-lg font-bold text-foreground">Low Stock Warnings</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-rose-500/30 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center font-bold text-lg">
            {outOfStockCount}
          </div>
          <div>
            <div className="text-xs font-semibold text-rose-500 uppercase">Auto-86 Active</div>
            <div className="text-lg font-bold text-foreground">Depleted Stock</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-xl bg-card border border-border">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search ingredients (e.g. Paneer, Basmati, Saffron)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFilterLow(!filterLow)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors flex items-center gap-1.5 ${
              filterLow
                ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                : "bg-background text-muted-foreground border-border hover:text-foreground"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Low / Depleted Only ({lowStockCount + outOfStockCount})</span>
          </button>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="rounded-2xl bg-card border border-border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/40 border-b border-border text-xs text-muted-foreground uppercase font-semibold">
              <tr>
                <th className="px-5 py-3">Ingredient</th>
                <th className="px-5 py-3">Stock Meter</th>
                <th className="px-5 py-3">Par Level</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Linked Recipes</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-muted-foreground text-xs">
                    No ingredients found.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const stockPercent = Math.min(100, Math.round((item.currentStock / (item.parLevel * 1.5 || 1)) * 100));

                  return (
                    <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-semibold text-foreground">{item.name}</div>
                        <div className="text-xs text-muted-foreground">Unit: {item.unit}</div>
                      </td>

                      <td className="px-5 py-4 w-48">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-bold text-foreground">
                            {item.currentStock} {item.unit}
                          </span>
                          <span className="text-muted-foreground text-[11px]">
                            {stockPercent}%
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              item.isOutOfStock
                                ? "bg-rose-500 w-0"
                                : item.isLowStock
                                ? "bg-amber-500"
                                : "bg-emerald-500"
                            }`}
                            style={{ width: `${item.isOutOfStock ? 0 : Math.max(8, stockPercent)}%` }}
                          />
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span className="text-xs font-mono text-muted-foreground">
                          {item.parLevel} {item.unit}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        {item.isOutOfStock ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40">
                            <AlertOctagon className="w-3 h-3" />
                            OUT OF STOCK (86)
                          </span>
                        ) : item.isLowStock ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/40">
                            <AlertTriangle className="w-3 h-3" />
                            Low Stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="w-3 h-3" />
                            Optimal
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <span className="text-xs px-2 py-1 rounded bg-muted font-medium text-foreground">
                          {item.recipeCount} {item.recipeCount === 1 ? "dish" : "dishes"}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setRestockModalItem(item);
                              setRestockQty("10");
                            }}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-colors"
                          >
                            + Restock
                          </button>
                          <button
                            type="button"
                            disabled={isPending || item.isOutOfStock}
                            onClick={() => handleQuickZero(item)}
                            title="Simulate complete depletion and Auto-86"
                            className="px-2 py-1.5 rounded-lg text-xs font-medium bg-muted hover:bg-rose-500/20 hover:text-rose-400 border border-border transition-colors disabled:opacity-30"
                          >
                            Set 0
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Restock Modal */}
      {restockModalItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-xl p-6 space-y-4">
            <h3 className="text-lg font-bold font-serif text-foreground">
              Restock {restockModalItem.name}
            </h3>
            <p className="text-xs text-muted-foreground">
              Current stock: <strong>{restockModalItem.currentStock} {restockModalItem.unit}</strong>.
              Restocking above 0 will automatically restore any Auto-86&apos;d dishes if all their required recipe ingredients are back in stock.
            </p>

            <form onSubmit={handleRestockSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Quantity to Add ({restockModalItem.unit})
                </label>
                <input
                  type="number"
                  min="0.1"
                  step="any"
                  required
                  value={restockQty}
                  onChange={(e) => setRestockQty(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRestockModalItem(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground border border-border transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isPending ? "animate-spin" : ""}`} />
                  Confirm Restock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Ingredient Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-xl p-6 space-y-4">
            <h3 className="text-lg font-bold font-serif text-foreground">
              Add New Raw Ingredient
            </h3>

            <form onSubmit={handleCreateSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-foreground mb-1">Ingredient Name</label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="e.g. Fresh Paneer, Kashmiri Chili"
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-foreground mb-1">Unit</label>
                  <select
                    name="unit"
                    defaultValue="kg"
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="kg">kg (Kilograms)</option>
                    <option value="g">g (Grams)</option>
                    <option value="l">l (Litres)</option>
                    <option value="ml">ml (Millilitres)</option>
                    <option value="pcs">pcs (Pieces)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-foreground mb-1">Initial Stock</label>
                  <input
                    type="number"
                    name="currentStock"
                    defaultValue="10"
                    step="any"
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-foreground mb-1">Par Level (Min Warning)</label>
                  <input
                    type="number"
                    name="parLevel"
                    defaultValue="5"
                    step="any"
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-foreground mb-1">Cost Per Unit (₹)</label>
                  <input
                    type="number"
                    name="costPerUnit"
                    placeholder="Optional"
                    step="any"
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground border border-border transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Save Ingredient
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
