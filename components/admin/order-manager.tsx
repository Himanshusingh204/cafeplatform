"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { formatPrice } from "@/lib/utils/format";
import { updateOrderStatusAction } from "@/app/admin/actions/orders";
import type { OrderStatus, PaymentStatus } from "@/lib/generated/prisma/enums";

export interface OrderRow {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  pickupTime: string;
  specialInstructions?: string | null;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  couponCode?: string | null;
  createdAt: string;
  items: Array<{
    id: string;
    dishName: string;
    quantity: number;
    price: number;
  }>;
}

export function OrderManager({
  orders: initialRows,
  canManage = false,
}: {
  orders: OrderRow[];
  canManage?: boolean;
}) {
  const [rows, setRows] = React.useState(initialRows);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL");
  const [loadingId, setLoadingId] = React.useState<string | null>(null);
  const [dateFilter, setDateFilter] = React.useState("");
  const [message, setMessage] = React.useState<{ kind: "error" | "success"; text: string } | null>(null);

  const filtered = rows.filter((o) => {
    const matchesSearch =
      o.customerName.toLowerCase().includes(search.toLowerCase()) ||
      o.customerPhone.includes(search) ||
      o.orderNumber.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || o.orderStatus === statusFilter;
    const matchesDate = !dateFilter || o.createdAt.slice(0, 10) === dateFilter;
    return matchesSearch && matchesStatus && matchesDate;
  });

  const exportHref = `/admin/orders/export?${new URLSearchParams({
    ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
    ...(dateFilter ? { date: dateFilter } : {}),
  }).toString()}`;

  async function handleStatus(id: string, status: OrderStatus) {
    if (status === "CANCELLED" && !confirm("Cancel this order? The guest will not be notified automatically.")) return;
    const previous = rows.find((o) => o.id === id)?.orderStatus;
    setLoadingId(id);
    setMessage(null);
    setRows((prev) => prev.map((o) => (o.id === id ? { ...o, orderStatus: status } : o)));
    try {
      const res = await updateOrderStatusAction(id, status);
      if (!res.ok) throw new Error(res.error ?? "Failed to update order.");
      setMessage({ kind: "success", text: `Order updated to ${status.toLowerCase()}.` });
    } catch (err) {
      if (previous) setRows((prev) => prev.map((o) => (o.id === id ? { ...o, orderStatus: previous } : o)));
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "Failed to update order." });
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Filter Tabs & Search */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {["ALL", "PENDING", "PREPARING", "READY", "COMPLETED"].map((st) => (
            <button
              key={st}
              type="button"
              aria-pressed={statusFilter === st}
              onClick={() => setStatusFilter(st)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                statusFilter === st
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-card text-muted-foreground hover:bg-muted"
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="order-date">Filter by date</label>
          <input
            id="order-date"
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="h-9 rounded-full border border-border bg-card px-3 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
          />
          {canManage && (
            <a
              href={exportHref}
              className="inline-flex h-9 items-center rounded-full border border-border bg-card px-4 text-xs font-semibold hover:bg-muted"
            >
              Export CSV
            </a>
          )}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            aria-label="Search orders"
            placeholder="Name, phone or order number"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-72 max-w-full rounded-full border border-border bg-card pl-9 pr-3 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
          />
        </div>
        </div>
      </div>

      {message && (
        <p
          role={message.kind === "error" ? "alert" : "status"}
          className={`rounded-lg px-3 py-2 text-xs font-medium ${
            message.kind === "error" ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"
          }`}
        >
          {message.text}
        </p>
      )}

      {/* Orders Grid / List */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">
          No orders found matching this filter.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((order) => (
            <div
              key={order.id}
              className="rounded-2xl border border-border bg-card p-5 shadow-card flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between border-b border-border pb-3 mb-3">
                  <div>
                    <span className="text-base font-bold text-foreground">{order.orderNumber}</span>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                      order.orderStatus === "READY"
                        ? "bg-success/15 text-success"
                        : order.orderStatus === "PREPARING"
                        ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                        : order.orderStatus === "COMPLETED"
                        ? "bg-muted text-muted-foreground"
                        : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                    }`}
                  >
                    {order.orderStatus}
                  </span>
                </div>

                <div className="text-xs space-y-1 mb-3">
                  <p className="font-semibold text-foreground">{order.customerName}</p>
                  <p className="text-muted-foreground">{order.customerPhone}</p>
                  <p className="text-primary font-medium">Pickup: {order.pickupTime}</p>
                </div>

                {order.specialInstructions && (
                  <p className="rounded bg-amber-500/10 p-2 text-[11px] text-amber-700 dark:text-amber-300 italic mb-3">
                    Note: {order.specialInstructions}
                  </p>
                )}

                {/* Items */}
                <div className="rounded-lg bg-muted/40 p-3 mb-4 space-y-1 text-xs">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block mb-1.5">
                    Bag Contents ({order.items.length})
                  </span>
                  {order.items.map((item) => (
                    <div key={item.id} className="flex justify-between">
                      <span>{item.quantity} × {item.dishName}</span>
                      <span className="font-medium">{formatPrice(item.price * item.quantity)}</span>
                    </div>
                  ))}
                  <div className="border-t border-border pt-1.5 mt-2 flex justify-between font-bold text-foreground">
                    <span>Total</span>
                    <span className="text-primary">{formatPrice(order.total)}</span>
                  </div>
                </div>
              </div>

              {/* Status Action Buttons */}
              {canManage && (
              <div className="border-t border-border pt-3 flex gap-2">
                {order.orderStatus === "PENDING" && (
                  <button
                    type="button"
                    disabled={loadingId === order.id}
                    onClick={() => handleStatus(order.id, "PREPARING")}
                    className="flex-1 rounded-lg bg-blue-600 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    Start Preparing
                  </button>
                )}
                {order.orderStatus === "PREPARING" && (
                  <button
                    type="button"
                    disabled={loadingId === order.id}
                    onClick={() => handleStatus(order.id, "READY")}
                    className="flex-1 rounded-lg bg-amber-600 py-2 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                  >
                    Mark Ready
                  </button>
                )}
                {order.orderStatus === "READY" && (
                  <button
                    type="button"
                    disabled={loadingId === order.id}
                    onClick={() => handleStatus(order.id, "COMPLETED")}
                    className="flex-1 rounded-lg bg-success py-2 text-xs font-semibold text-white hover:bg-success/90 disabled:opacity-50"
                  >
                    Hand to Guest
                  </button>
                )}
                {order.orderStatus !== "CANCELLED" && order.orderStatus !== "COMPLETED" && (
                  <button
                    type="button"
                    disabled={loadingId === order.id}
                    onClick={() => handleStatus(order.id, "CANCELLED")}
                    className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-destructive hover:text-white disabled:opacity-50"
                  >
                    Cancel
                  </button>
                )}
              </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
