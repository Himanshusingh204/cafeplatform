"use client";

import * as React from "react";
import { Star, Check, Trash2, EyeOff, Sparkles } from "lucide-react";
import { moderateReviewAction, deleteReviewAction } from "@/app/admin/actions/reviews";
import { useConfirm } from "@/components/admin/confirm-dialog";

export interface ReviewRow {
  id: string;
  customerName: string;
  rating: number;
  title: string;
  comment: string;
  dishSlug?: string | null;
  isApproved: boolean;
  isFeatured: boolean;
  createdAt: string;
}

export function ReviewManager({
  reviews: initialRows,
  canModerate = true,
}: {
  reviews: ReviewRow[];
  canModerate?: boolean;
}) {
  const [error, setError] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [rows, setRows] = React.useState(initialRows);
  const [filter, setFilter] = React.useState<"ALL" | "PENDING" | "APPROVED">("ALL");

  const filtered = rows.filter((r) => {
    if (filter === "PENDING") return !r.isApproved;
    if (filter === "APPROVED") return r.isApproved;
    return true;
  });

  async function handleToggleApprove(id: string, current: boolean) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, isApproved: !current } : r)));
    await run(id, () => moderateReviewAction(id, { isApproved: !current }), () =>
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, isApproved: current } : r)))
    );
  }

  async function handleToggleFeatured(id: string, current: boolean) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, isFeatured: !current } : r)));
    await run(id, () => moderateReviewAction(id, { isFeatured: !current }), () =>
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, isFeatured: current } : r)))
    );
  }

  async function handleDelete(id: string) {
    if (!(await confirm({ title: "Delete review", message: "This customer review will be permanently removed." }))) return;
    const snapshot = rows;
    setRows((prev) => prev.filter((r) => r.id !== id));
    await run(id, () => deleteReviewAction(id), () => setRows(snapshot));
  }

  async function run(
    id: string,
    action: () => Promise<{ ok: boolean; error?: string }>,
    rollback: () => void
  ) {
    setError(null);
    setBusyId(id);
    try {
      const res = await action();
      if (!res.ok) {
        rollback();
        setError(res.error || "That change could not be saved.");
      }
    } catch {
      rollback();
      setError("That change could not be saved. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  const { confirm, dialog } = useConfirm();

  return (
    <div className="space-y-4">
      {dialog}
      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        {(["ALL", "PENDING", "APPROVED"] as const).map((st) => (
          <button
            key={st}
            onClick={() => setFilter(st)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              filter === st
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-card text-muted-foreground hover:bg-muted"
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">
          No reviews match this view. Reviews appear here after customers submit them.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((rev) => (
            <div
              key={rev.id}
              className="rounded-2xl border border-border bg-card p-5 shadow-card flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between border-b border-border pb-3 mb-3">
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`h-3.5 w-3.5 ${
                          i < rev.rating ? "fill-amber-400 text-amber-400" : "fill-muted text-muted"
                        }`}
                      />
                    ))}
                  </div>

                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      rev.isApproved
                        ? "bg-success/15 text-success"
                        : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                    }`}
                  >
                    {rev.isApproved ? "Approved" : "Pending Moderation"}
                  </span>
                </div>

                <h3 className="text-sm font-semibold text-foreground mb-1">{rev.title}</h3>
                <p className="text-xs text-muted-foreground italic leading-relaxed line-clamp-3">
                  &ldquo;{rev.comment}&rdquo;
                </p>

                <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="font-medium text-foreground">{rev.customerName}</span>
                  <span>{new Date(rev.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}</span>
                </div>
              </div>

              {/* Action Buttons */}
              {canModerate ? (
              <div className="border-t border-border pt-3 mt-4 flex items-center justify-between gap-2">
                <button
                  type="button"
                  disabled={busyId === rev.id}
                  onClick={() => handleToggleApprove(rev.id, rev.isApproved)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                    rev.isApproved
                      ? "border border-border text-muted-foreground hover:bg-muted"
                      : "bg-success text-white hover:bg-success/90"
                  }`}
                >
                  {rev.isApproved ? (
                    <>
                      <EyeOff className="h-3 w-3" /> Unpublish
                    </>
                  ) : (
                    <>
                      <Check className="h-3 w-3" /> Approve
                    </>
                  )}
                </button>

                <button
                  type="button"
                  disabled={busyId === rev.id}
                  onClick={() => handleToggleFeatured(rev.id, rev.isFeatured)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                    rev.isFeatured
                      ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                      : "border border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Sparkles className="h-3 w-3" />
                  {rev.isFeatured ? "Featured" : "Feature"}
                </button>

                <button
                  type="button"
                  disabled={busyId === rev.id}
                  onClick={() => handleDelete(rev.id)}
                  aria-label="Delete review"
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive hover:text-white"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              ) : (
                <p className="mt-4 border-t border-border pt-3 text-[11px] text-muted-foreground">
                  Your role can view reviews but not moderate them.
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
