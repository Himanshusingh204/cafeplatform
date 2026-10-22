"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  adminCreateIngredientAction,
  adminRestockIngredientAction,
  adminUpdateStockAction,
} from "@/app/admin/actions/inventory";
import { Plus, RefreshCw, AlertTriangle, AlertOctagon, CheckCircle2, Search } from "lucide-react";
import { useConfirm } from "@/components/admin/confirm-dialog";
import { Field, StatusMessage, controlClass, type FieldErrors } from "@/components/admin/form-field";

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
  canEdit?: boolean;
}

export function InventoryManager({ initialIngredients, canEdit = true }: InventoryManagerProps) {
  const router = useRouter();
  const [ingredients, setIngredients] = useState<InventoryItem[]>(initialIngredients);
  // Re-sync local list when the server re-renders with fresh data (router.refresh()).
  const [seenIngredients, setSeenIngredients] = useState(initialIngredients);
  if (seenIngredients !== initialIngredients) {
    setSeenIngredients(initialIngredients);
    setIngredients(initialIngredients);
  }
  const [search, setSearch] = useState("");
  const [filterLow, setFilterLow] = useState(false);
  const [restockModalItem, setRestockModalItem] = useState<InventoryItem | null>(null);
  const [restockQty, setRestockQty] = useState<string>("10");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
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
    if (isNaN(addVal) || addVal <= 0) {
      setFieldErrors({ restockQty: "Enter a quantity greater than 0." });
      return;
    }

    setFieldErrors({});
    setErrorMsg(null);
    setNotice(null);
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
        setNotice(`Restocked ${restockModalItem.name}.`);
        setRestockModalItem(null);
      } else {
        setFieldErrors({ restockQty: res.error || "Failed to restock" });
        setErrorMsg(res.error || "Failed to restock");
      }
    });
  };

  const handleQuickZero = async (item: InventoryItem) => {
    const ok = await confirm({ title: "Set stock to zero", message: `Set "${item.name}" to 0? Linked dishes will be marked unavailable automatically.`, confirmLabel: "Set to zero" });
    if (!ok) return;

    setErrorMsg(null);
    setNotice(null);
    const previous = item;
    setIngredients((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, currentStock: 0, isOutOfStock: true, isLowStock: true } : i))
    );
    startTransition(async () => {
      const fd = new FormData();
      fd.append("ingredientId", item.id);
      fd.append("exactStock", "0");

      const res = await adminUpdateStockAction(fd);
      if (res.ok) {
        setNotice(`${item.name} set to 0.`);
      } else {
        setIngredients((prev) => prev.map((i) => (i.id === item.id ? previous : i)));
        setErrorMsg(res.error || "Could not update the stock. The change was undone.");
      }
    });
  };

  const handleCreateSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);

    if (!String(fd.get("name") ?? "").trim()) {
      setFieldErrors({ name: "Ingredient name is required." });
      return;
    }
    setFieldErrors({});
    setErrorMsg(null);
    setNotice(null);
    startTransition(async () => {
      const res = await adminCreateIngredientAction(fd);
      if (res.ok) {
        setIsAddOpen(false);
        router.refresh();
      } else {
        setFieldErrors(/name/i.test(res.error ?? "") ? { name: res.error ?? "" } : {});
        setErrorMsg(res.error || "Failed to create ingredient");
      }
    });
  };

  const { confirm, dialog } = useConfirm();

  return (
    <div className="space-y-6">
      {dialog}
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

        {canEdit ? (
        <button
          type="button"
          onClick={() => {
            setErrorMsg(null);
            setFieldErrors({});
            setIsAddOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add Raw Ingredient
        </button>
        ) : null}
      </div>

      {!restockModalItem && !isAddOpen ? <StatusMessage ok={notice} error={errorMsg} /> : null}

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
          <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold text-lg">
            {lowStockCount}
          </div>
          <div>
            <div className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase">Below Par Level</div>
            <div className="text-lg font-bold text-foreground">Low Stock Warnings</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-rose-500/30 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-rose-500/10 text-rose-700 dark:text-rose-300 flex items-center justify-center font-bold text-lg">
            {outOfStockCount}
          </div>
          <div>
            <div className="text-xs font-semibold text-rose-700 dark:text-rose-300 uppercase">Auto-86 Active</div>
            <div className="text-lg font-bold text-foreground">Depleted Stock</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-xl bg-card border border-border">
        <div className="relative flex-1">
          <Search aria-hidden="true" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            id="inventory-search"
            aria-label="Search ingredients"
            placeholder="Search ingredients (e.g. Paneer, Basmati, Saffron)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-pressed={filterLow}
            onClick={() => setFilterLow(!filterLow)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors flex items-center gap-1.5 ${
              filterLow
                ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40"
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
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-muted/40 border-b border-border text-xs text-muted-foreground uppercase font-semibold">
              <tr>
                <th scope="col" className="px-5 py-3">Ingredient</th>
                <th scope="col" className="px-5 py-3">Stock Meter</th>
                <th scope="col" className="px-5 py-3">Par Level</th>
                <th scope="col" className="px-5 py-3">Status</th>
                <th scope="col" className="px-5 py-3">Linked Recipes</th>
                <th scope="col" className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-muted-foreground text-sm">
                    {ingredients.length === 0
                      ? canEdit
                        ? "No ingredients yet. Select Add Raw Ingredient above to track your first item, then link it to dish recipes."
                        : "No ingredients yet. Ask an admin or editor to add the first one."
                      : "No ingredients match your search or filter."}
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
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-destructive/15 text-destructive border border-destructive/40">
                            <AlertOctagon className="w-3 h-3" />
                            OUT OF STOCK (86)
                          </span>
                        ) : item.isLowStock ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40">
                            <AlertTriangle className="w-3 h-3" />
                            Low Stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
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
                          {canEdit ? (<>
                          <button
                            type="button"
                            onClick={() => {
                              setRestockModalItem(item);
                              setRestockQty("10");
                              setFieldErrors({});
                              setErrorMsg(null);
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
                          </>) : (
                            <span className="text-xs text-muted-foreground">View only</span>
                          )}
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
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onKeyDown={(e) => e.key === "Escape" && setRestockModalItem(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="restock-title" className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-card border border-border rounded-2xl shadow-xl p-6 space-y-4">
            <h3 id="restock-title" className="text-lg font-bold font-serif text-foreground">
              Restock {restockModalItem.name}
            </h3>
            <p className="text-xs text-muted-foreground">
              Current stock: <strong>{restockModalItem.currentStock} {restockModalItem.unit}</strong>.
              Restocking above 0 will automatically restore any Auto-86&apos;d dishes if all their required recipe ingredients are back in stock.
            </p>

            <form onSubmit={handleRestockSubmit} noValidate className="space-y-4">
              <Field id="restock-qty" label={`Quantity to add (${restockModalItem.unit})`} required error={fieldErrors.restockQty}>
                {(p) => (
                  <input
                    {...p}
                    type="number"
                    min="0.1"
                    step="any"
                    autoFocus
                    value={restockQty}
                    onChange={(e) => setRestockQty(e.target.value)}
                    className={controlClass}
                  />
                )}
              </Field>

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
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-1.5 disabled:opacity-60"
                >
                  <RefreshCw aria-hidden="true" className={`w-3.5 h-3.5 ${isPending ? "animate-spin" : ""}`} />
                  {isPending ? "Saving..." : "Confirm Restock"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Ingredient Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onKeyDown={(e) => e.key === "Escape" && setIsAddOpen(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="add-ingredient-title" className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-card border border-border rounded-2xl shadow-xl p-6 space-y-4">
            <h3 id="add-ingredient-title" className="text-lg font-bold font-serif text-foreground">
              Add New Raw Ingredient
            </h3>

            <form onSubmit={handleCreateSubmit} noValidate className="space-y-3">
              <Field id="ingredient-name" label="Ingredient name" required error={fieldErrors.name}>
                {(p) => (
                  <input {...p} type="text" name="name" autoFocus placeholder="e.g. Fresh Paneer, Kashmiri Chili" className={controlClass} />
                )}
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field id="ingredient-unit" label="Unit">
                  {(p) => (
                    <select {...p} name="unit" defaultValue="kg" className={controlClass}>
                      <option value="kg">kg (Kilograms)</option>
                      <option value="g">g (Grams)</option>
                      <option value="l">l (Litres)</option>
                      <option value="ml">ml (Millilitres)</option>
                      <option value="pcs">pcs (Pieces)</option>
                    </select>
                  )}
                </Field>
                <Field id="ingredient-stock" label="Initial stock">
                  {(p) => <input {...p} type="number" name="currentStock" defaultValue="10" step="any" min="0" className={controlClass} />}
                </Field>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field id="ingredient-par" label="Par level (min warning)">
                  {(p) => <input {...p} type="number" name="parLevel" defaultValue="5" step="any" min="0" className={controlClass} />}
                </Field>
                <Field id="ingredient-cost" label="Cost per unit (INR)">
                  {(p) => <input {...p} type="number" name="costPerUnit" placeholder="Optional" step="any" min="0" className={controlClass} />}
                </Field>
              </div>

              <StatusMessage error={errorMsg} />

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
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60"
                >
                  {isPending ? "Saving..." : "Save Ingredient"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
