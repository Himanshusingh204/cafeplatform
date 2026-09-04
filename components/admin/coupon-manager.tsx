"use client";

import * as React from "react";
import { Tag, Plus, Trash2, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { createCouponAction, toggleCouponAction, deleteCouponAction } from "@/app/admin/actions/coupons";
import { formatPrice } from "@/lib/utils/format";

export interface AdminCoupon {
  id: string;
  code: string;
  discountPercent: number;
  minOrder: number | null;
  isActive: boolean;
  validUntil: string | null;
  createdAt: string;
}

interface CouponManagerProps {
  initialCoupons: AdminCoupon[];
}

export function CouponManager({ initialCoupons }: CouponManagerProps) {
  const [coupons, setCoupons] = React.useState<AdminCoupon[]>(initialCoupons);
  const [showModal, setShowModal] = React.useState(false);
  const [code, setCode] = React.useState("");
  const [discountPercent, setDiscountPercent] = React.useState(10);
  const [minOrder, setMinOrder] = React.useState<string>("");
  const [validUntil, setValidUntil] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await createCouponAction({
        code,
        discountPercent,
        minOrder: minOrder ? Number(minOrder) : null,
        validUntil: validUntil || null,
        isActive: true,
      });

      if (!res.ok) {
        setError(res.error ?? "Failed to create coupon");
      } else {
        setShowModal(false);
        setCode("");
        setDiscountPercent(10);
        setMinOrder("");
        setValidUntil("");
        // Optimistic append
        setCoupons((prev) => [
          {
            id: `temp-${Date.now()}`,
            code: code.toUpperCase().trim(),
            discountPercent,
            minOrder: minOrder ? Number(minOrder) : null,
            isActive: true,
            validUntil: validUntil || null,
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ]);
      }
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleToggle(id: string, current: boolean) {
    const next = !current;
    setCoupons((prev) => prev.map((c) => (c.id === id ? { ...c, isActive: next } : c)));
    await toggleCouponAction(id, next);
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this coupon?")) return;
    setCoupons((prev) => prev.filter((c) => c.id !== id));
    await deleteCouponAction(id);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="heading-display text-2xl font-bold text-foreground">Promo Coupons</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Manage promotional discount codes for takeaway checkout.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>New Coupon</span>
        </button>
      </div>

      {coupons.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <Tag className="mx-auto h-8 w-8 text-muted-foreground opacity-40" />
          <h3 className="mt-3 text-sm font-semibold text-foreground">No coupons yet</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Create promotional codes like WELCOME10 or FESTIVE20 to offer discounts to customers.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/40 font-semibold text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">Code</th>
                  <th className="px-5 py-3">Discount</th>
                  <th className="px-5 py-3">Min. Order</th>
                  <th className="px-5 py-3">Valid Until</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {coupons.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-4 font-mono font-bold text-primary">
                      {c.code}
                    </td>
                    <td className="px-5 py-4 font-semibold text-foreground">
                      {c.discountPercent}% OFF
                    </td>
                    <td className="px-5 py-4 text-muted-foreground">
                      {c.minOrder ? formatPrice(c.minOrder) : "None"}
                    </td>
                    <td className="px-5 py-4 text-muted-foreground">
                      {c.validUntil
                        ? new Date(c.validUntil).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "No Expiry"}
                    </td>
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        onClick={() => handleToggle(c.id, c.isActive)}
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                          c.isActive
                            ? "bg-success/15 text-success hover:bg-success/25"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        {c.isActive ? (
                          <>
                            <CheckCircle2 className="h-3 w-3" /> Active
                          </>
                        ) : (
                          <>
                            <XCircle className="h-3 w-3" /> Inactive
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleDelete(c.id)}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                        aria-label="Delete coupon"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">Create Promotional Coupon</h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div>
                <label className="font-medium text-foreground block mb-1">Coupon Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SPICE20"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 uppercase font-mono font-semibold tracking-wider text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                />
              </div>

              <div>
                <label className="font-medium text-foreground block mb-1">Discount Percentage (%) *</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  required
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(Number(e.target.value))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                />
              </div>

              <div>
                <label className="font-medium text-foreground block mb-1">Minimum Order Amount (₹, optional)</label>
                <input
                  type="number"
                  min={0}
                  placeholder="e.g. 500"
                  value={minOrder}
                  onChange={(e) => setMinOrder(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                />
              </div>

              <div>
                <label className="font-medium text-foreground block mb-1">Expiration Date (optional)</label>
                <input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border border-border px-4 py-2 text-xs font-semibold hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {isSubmitting ? "Creating..." : "Create Coupon"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
