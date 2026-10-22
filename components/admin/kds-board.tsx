"use client";

import { useEffect, useState, useTransition, useCallback } from "react";
import {
  updateOrderStatusAction,
  getActiveKDSOrdersAction,
  adminBumpOrderItemAction,
} from "@/app/admin/actions/orders";
import type { OrderStatus } from "@/lib/generated/prisma/enums";

export interface KDSTicketItem {
  id: string;
  dishName: string;
  quantity: number;
  price: string | number;
  station?: string;
  isCompleted?: boolean;
  modifiers?: { groupName: string; optionName: string; priceDelta: number }[];
}

export interface KDSTicket {
  id: string;
  orderNumber: string;
  customerName: string;
  pickupTime: string;
  diningMode?: "DINE_IN" | "TAKEAWAY" | "DELIVERY";
  tableNumber?: string | null;
  tip?: string | number;
  specialInstructions?: string | null;
  total: string | number;
  orderStatus: "PENDING" | "CONFIRMED" | "PREPARING" | "READY" | "COMPLETED" | "CANCELLED";
  createdAt: string | Date;
  items: KDSTicketItem[];
}

interface KDSBoardProps {
  initialOrders: KDSTicket[];
  /** Move tickets and bump items (MANAGE_ORDERS). Read-only when false. */
  canManage?: boolean;
}

const escapeHtml = (value: unknown) =>
  String(value ?? "").replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

const STATIONS = [
  { id: "ALL", label: "All Stations (Expo)", icon: "📋" },
  { id: "HOT_KITCHEN", label: "Hot Kitchen", icon: "🔥" },
  { id: "TANDOOR", label: "Tandoor & Breads", icon: "🫓" },
  { id: "BARISTA", label: "Chai & Barista", icon: "☕" },
  { id: "PASTRY", label: "Mithai & Pastry", icon: "🧁" },
] as const;

export function KDSBoard({ initialOrders, canManage = true }: KDSBoardProps) {
  const [orders, setOrders] = useState<KDSTicket[]>(initialOrders);
  const [selectedStation, setSelectedStation] = useState<string>("ALL");
  const [isConnected, setIsConnected] = useState(false);
  const [lastPing, setLastPing] = useState<string>("Connecting...");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  // Keep now updated every 15 seconds for elapsed time & SLA rendering
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, []);

  // Print 80mm ESC/POS formatted kitchen chit
  const printChit = useCallback((order: KDSTicket) => {
    if (typeof window === "undefined") return;
    const win = window.open("", "_blank", "width=380,height=600");
    if (!win) return;

    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Chit #${escapeHtml(order.orderNumber)}</title>
          <style>
            @page { margin: 0; }
            body {
              font-family: monospace;
              width: 76mm;
              padding: 8px;
              margin: 0;
              font-size: 13px;
              line-height: 1.3;
              color: #000;
            }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .order-no { font-size: 24px; font-weight: bold; margin: 4px 0; }
            .mode-badge { display: inline-block; padding: 3px 8px; border: 2px solid #000; font-weight: bold; font-size: 14px; margin: 4px 0; }
            .divider { border-bottom: 1px dashed #000; margin: 8px 0; }
            .item-line { font-size: 14px; font-weight: bold; margin-top: 5px; }
            .mod-line { font-size: 12px; margin-left: 14px; font-weight: normal; }
          </style>
        </head>
        <body>
          <div class="center">
            <div class="bold" style="font-size: 16px;">SPICE & SAFFRON</div>
            <div>KITCHEN EXPEDITE CHIT</div>
            <div class="order-no">${escapeHtml(order.orderNumber)}</div>
            <div class="mode-badge">${order.diningMode === "DINE_IN" ? `TABLE ${escapeHtml(order.tableNumber || "DINE-IN")}` : "TAKEAWAY PICKUP"}</div>
            <div>Target: <strong>${escapeHtml(order.pickupTime)}</strong></div>
          </div>
          <div class="divider"></div>
          <div>Guest: <strong>${escapeHtml(order.customerName)}</strong></div>
          <div class="divider"></div>
          ${order.items
            .map(
              (item) => `
            <div class="item-line">[ ${escapeHtml(item.quantity)}x ] ${escapeHtml(item.dishName)} (${escapeHtml(item.station || "HOT_KITCHEN")})</div>
            ${(item.modifiers || []).map((m) => `<div class="mod-line">• ${escapeHtml(m.optionName)}</div>`).join("")}
          `
            )
            .join("")}
          <div class="divider"></div>
          ${order.specialInstructions ? `<div><strong>NOTE:</strong> ${escapeHtml(order.specialInstructions)}</div><div class="divider"></div>` : ""}
          <div class="center" style="font-size: 11px;">*** SEND TO PASS ***</div>
          <script>
            window.onload = function() { window.print(); window.close(); };
          </script>
        </body>
      </html>
    `);
    win.document.close();
  }, []);

  // Play audio chime for new orders
  const playAlertSound = useCallback(() => {
    if (!soundEnabled || typeof window === "undefined") return;
    try {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtxClass) return;

      const audioCtx = new AudioCtxClass();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.1); // A5
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.35);
    } catch {
      // Audio context may be restricted by browser policy
    }
  }, [soundEnabled]);

  // Connect to SSE stream
  useEffect(() => {
    let eventSource: EventSource | null = null;

    try {
      eventSource = new EventSource("/api/v1/realtime/kds");

      eventSource.addEventListener("connected", () => {
        setIsConnected(true);
        setLastPing("Live Stream Connected");
      });

      eventSource.addEventListener("order:created", (e) => {
        try {
          const payload = JSON.parse(e.data);
          const newOrderData = payload.data;
          setOrders((prev) => {
            if (prev.some((o) => o.id === newOrderData.id)) return prev;
            return [
              {
                id: newOrderData.id,
                orderNumber: newOrderData.orderNumber,
                customerName: newOrderData.customerName,
                pickupTime: newOrderData.pickupTime || "ASAP",
                diningMode: newOrderData.diningMode || "TAKEAWAY",
                tableNumber: newOrderData.tableNumber,
                tip: newOrderData.tip,
                total: newOrderData.total,
                orderStatus: "PENDING",
                createdAt: new Date().toISOString(),
                items: newOrderData.items || [],
              },
              ...prev,
            ];
          });
          playAlertSound();
        } catch (err) {
          console.error("Error parsing order:created event", err);
        }
      });

      eventSource.addEventListener("order:status_changed", (e) => {
        try {
          const payload = JSON.parse(e.data);
          const { id, orderStatus } = payload.data;
          setOrders((prev) =>
            prev.map((order) => (order.id === id ? { ...order, orderStatus } : order))
          );
        } catch (err) {
          console.error("Error parsing order:status_changed event", err);
        }
      });

      eventSource.addEventListener("kds:item_bumped", (e) => {
        try {
          const payload = JSON.parse(e.data);
          const { orderId, orderItemId, isCompleted, allCompleted } = payload.data;
          setOrders((prev) =>
            prev.map((order) => {
              if (order.id !== orderId) return order;
              const updatedItems = order.items.map((i) =>
                i.id === orderItemId ? { ...i, isCompleted } : i
              );
              return {
                ...order,
                items: updatedItems,
                orderStatus:
                  allCompleted &&
                  (order.orderStatus === "PREPARING" || order.orderStatus === "CONFIRMED")
                    ? "READY"
                    : order.orderStatus,
              };
            })
          );
        } catch (err) {
          console.error("Error parsing kds:item_bumped event", err);
        }
      });

      eventSource.onerror = () => {
        setIsConnected(false);
        setLastPing("Reconnecting...");
      };
    } catch (err) {
      console.error("Failed to connect EventSource", err);
    }

    return () => {
      if (eventSource) eventSource.close();
    };
  }, [playAlertSound]);

  // Resilient multi-instance serverless fallback polling (every 12 seconds)
  useEffect(() => {
    const syncTickets = async () => {
      try {
        const latest = await getActiveKDSOrdersAction();
        setOrders((prev) => {
          const prevIds = new Set(prev.map((o: KDSTicket) => o.id));
          const hasNew = latest.some((o: KDSTicket) => !prevIds.has(o.id) && o.orderStatus === "PENDING");
          if (hasNew) {
            playAlertSound();
          }
          return latest as KDSTicket[];
        });
      } catch {
        // Network / silent ignore during offline or transitions
      }
    };

    const interval = setInterval(syncTickets, 12_000);
    return () => clearInterval(interval);
  }, [playAlertSound]);

  const handleAdvanceStatus = (orderId: string, nextStatus: KDSTicket["orderStatus"]) => {
    if (!canManage) return;
    const previous = orders.find((o) => o.id === orderId)?.orderStatus;
    setActionError(null);
    // Optimistic UI update
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, orderStatus: nextStatus } : o))
    );

    startTransition(async () => {
      try {
        const res = await updateOrderStatusAction(orderId, nextStatus as OrderStatus);
        if (!res.ok) throw new Error(res.error);
      } catch (err) {
        if (previous) {
          setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, orderStatus: previous } : o)));
        }
        setActionError(
          (err instanceof Error && err.message) || "Could not update the ticket. It was moved back."
        );
      }
    });
  };

  const handleToggleItemBump = (orderId: string, orderItemId: string, nextCompleted: boolean) => {
    if (!canManage) return;
    const snapshot = orders.find((o) => o.id === orderId);
    setActionError(null);
    // Optimistic item bumping
    setOrders((prev) =>
      prev.map((order) => {
        if (order.id !== orderId) return order;
        const updatedItems = order.items.map((it) =>
          it.id === orderItemId ? { ...it, isCompleted: nextCompleted } : it
        );
        const allCompleted = updatedItems.every((it) => it.isCompleted);
        return {
          ...order,
          items: updatedItems,
          orderStatus:
            allCompleted &&
            (order.orderStatus === "PREPARING" || order.orderStatus === "CONFIRMED")
              ? "READY"
              : order.orderStatus,
        };
      })
    );

    startTransition(async () => {
      try {
        const res = await adminBumpOrderItemAction(orderItemId, nextCompleted);
        if (!res.ok) throw new Error(res.error);
      } catch (err) {
        if (snapshot) setOrders((prev) => prev.map((o) => (o.id === orderId ? snapshot : o)));
        setActionError(
          (err instanceof Error && err.message) || "Could not bump the item. It was restored."
        );
      }
    });
  };

  // Filter orders by station if specific station selected
  const filteredOrders = orders.filter((o) => {
    if (selectedStation === "ALL") return true;
    return o.items.some((item) => (item.station || "HOT_KITCHEN") === selectedStation);
  });

  // Categorize columns
  const newOrders = filteredOrders.filter((o) => o.orderStatus === "PENDING");
  const inPrep = filteredOrders.filter(
    (o) => o.orderStatus === "PREPARING" || o.orderStatus === "CONFIRMED"
  );
  const readyOrders = filteredOrders.filter((o) => o.orderStatus === "READY");
  const completedOrders = filteredOrders.filter((o) => o.orderStatus === "COMPLETED").slice(0, 10);

  // SLA Aging calculation: <7m normal green, 7-12m warning amber, >12m SLA breach red
  const getSlaInfo = (createdAt: string | Date) => {
    const elapsedMinutes = Math.floor((now - new Date(createdAt).getTime()) / 60000);
    if (elapsedMinutes >= 12) {
      return {
        level: "BREACH",
        badgeClass: "bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/50 animate-pulse font-bold",
        cardBorder: "border-rose-500 ring-2 ring-rose-500/30",
        label: `🚨 ${elapsedMinutes}m (SLA Breach)`,
      };
    }
    if (elapsedMinutes >= 7) {
      return {
        level: "WARNING",
        badgeClass: "bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40 font-semibold",
        cardBorder: "border-amber-500/70",
        label: `⚠️ ${elapsedMinutes}m (Warning)`,
      };
    }
    return {
      level: "NORMAL",
      badgeClass: "bg-muted text-muted-foreground border border-border",
      cardBorder: "border-border",
      label: elapsedMinutes <= 0 ? "Just now" : `${elapsedMinutes}m ago`,
    };
  };

  return (
    <div className="space-y-6">
      {/* KDS Header Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-card border border-border">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold font-serif text-foreground">Kitchen Display System (KDS)</h1>
            <span
              role="status"
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                isConnected
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                  : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`}
              />
              {isConnected ? "Live WebSocket / SSE" : lastPing}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Multi-station routing, line-item bumping, and SLA ticket aging. Orders update in real-time.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            aria-pressed={soundEnabled}
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              soundEnabled
                ? "bg-primary/10 text-primary border-primary/30"
                : "bg-muted text-muted-foreground border-border"
            }`}
          >
            {soundEnabled ? "🔔 Chime Audio: ON" : "🔕 Chime Audio: OFF"}
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-muted hover:bg-muted/80 text-foreground border border-border transition-colors"
          >
            ↻ Force Refresh
          </button>
        </div>
      </div>

      {!canManage ? (
        <p role="status" className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
          View only. Your role cannot move tickets or bump items.
        </p>
      ) : null}
      {actionError ? (
        <p role="alert" className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {actionError}
        </p>
      ) : null}

      {/* Station Filter Tabs */}
      <div role="group" aria-label="Filter by station" className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-border">
        {STATIONS.map((station) => {
          const isActive = selectedStation === station.id;
          const stationCount = orders.filter((o) => {
            if (o.orderStatus === "COMPLETED" || o.orderStatus === "CANCELLED") return false;
            if (station.id === "ALL") return true;
            return o.items.some((i) => (i.station || "HOT_KITCHEN") === station.id);
          }).length;

          return (
            <button
              key={station.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => setSelectedStation(station.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 border ${
                isActive
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-card text-muted-foreground hover:text-foreground border-border hover:bg-muted/40"
              }`}
            >
              <span>{station.icon}</span>
              <span>{station.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  isActive
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}
              >
                {stationCount}
              </span>
            </button>
          );
        })}
      </div>

      {/* 4 Kanban Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {/* Column 1: New Orders */}
        <div className="flex flex-col rounded-2xl bg-card border border-rose-500/30 overflow-hidden shadow-sm">
          <div className="px-4 py-3 bg-rose-500/10 border-b border-rose-500/20 flex items-center justify-between">
            <span className="font-semibold text-sm text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
              Incoming New Orders
            </span>
            <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-700 dark:text-rose-300 text-xs font-bold">
              {newOrders.length}
            </span>
          </div>

          <div className="p-3 space-y-3 flex-1 overflow-y-auto max-h-[720px]">
            {newOrders.length === 0 ? (
              <p className="text-center py-12 text-xs text-muted-foreground">No new tickets. Orders from the website, tables and POS appear here the moment they are placed.</p>
            ) : (
              newOrders.map((order) => {
                const sla = getSlaInfo(order.createdAt);
                return (
                  <div
                    key={order.id}
                    className={`p-4 rounded-xl bg-background border-2 shadow-sm space-y-3 ${
                      sla.level === "BREACH"
                        ? sla.cardBorder
                        : "border-rose-500/40"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-xs font-mono font-bold text-rose-700 dark:text-rose-300 block">{order.orderNumber}</span>
                        <span className="font-semibold text-sm text-foreground">{order.customerName}</span>
                      </div>
                      <span className={`text-[11px] px-2 py-0.5 rounded ${sla.badgeClass}`}>
                        {sla.label}
                      </span>
                    </div>

                    {/* Dining Mode & Pickup */}
                    <div className="flex items-center justify-between gap-2 text-xs flex-wrap">
                      <div className="flex items-center gap-1.5">
                        {order.diningMode === "DINE_IN" ? (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/30">
                            🍽️ Table {order.tableNumber || "Dine-In"}
                          </span>
                        ) : (
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                            🛍️ Takeaway
                          </span>
                        )}
                        {order.tip && Number(order.tip) > 0 && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                            Tip: ₹{Number(order.tip).toFixed(0)}
                          </span>
                        )}
                      </div>
                      <span className="text-muted-foreground">
                        Pickup: <strong className="text-foreground">{order.pickupTime}</strong>
                      </span>
                    </div>

                    {/* Items List with Modifiers & Station Badge */}
                    <div className="space-y-1.5 pt-2 border-t border-border">
                      {order.items.map((item) => {
                        const isCurrentStation =
                          selectedStation === "ALL" ||
                          (item.station || "HOT_KITCHEN") === selectedStation;

                        return (
                          <div
                            key={item.id}
                            className={`p-1.5 rounded-lg border transition-colors ${
                              item.isCompleted
                                ? "bg-emerald-500/10 border-emerald-500/20 opacity-60"
                                : isCurrentStation
                                ? "bg-card border-border"
                                : "bg-muted/30 border-dashed border-border opacity-50"
                            }`}
                          >
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-medium text-foreground flex items-center gap-1.5">
                                <span className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-700 dark:text-rose-300 flex items-center justify-center text-[10px] font-bold">
                                  {item.quantity}
                                </span>
                                <span className={item.isCompleted ? "line-through text-muted-foreground" : ""}>
                                  {item.dishName}
                                </span>
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase font-mono">
                                {(item.station || "HOT").replace("_", " ")}
                              </span>
                            </div>
                            {item.modifiers && item.modifiers.length > 0 && (
                              <div className="pl-6 pt-0.5 space-y-0.5">
                                {item.modifiers.map((m, mIdx) => (
                                  <div key={mIdx} className="text-[11px] text-muted-foreground flex items-center gap-1">
                                    <span className="text-primary/70">↳</span>
                                    <span>{m.optionName}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {order.specialInstructions && (
                      <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-300">
                        ⚠️ {order.specialInstructions}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => printChit(order)}
                        className="px-2.5 py-2 rounded-lg text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground border border-border transition-colors flex items-center gap-1"
                        title="Print Kitchen Expedite Chit (80mm)"
                      >
                        🖨️ Chit
                      </button>
                      <button
                        type="button"
                        disabled={isPending || !canManage}
                        onClick={() => handleAdvanceStatus(order.id, "PREPARING")}
                        className="flex-1 py-1.5 px-3 rounded-lg text-xs font-bold bg-destructive hover:bg-destructive/90 text-destructive-foreground transition-colors shadow-sm disabled:opacity-60 flex items-center justify-center gap-1.5"
                      >
                        🔥 Start Cooking
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Column 2: In Preparation (With Line-Item Bumping) */}
        <div className="flex flex-col rounded-2xl bg-card border border-amber-500/30 overflow-hidden shadow-sm">
          <div className="px-4 py-3 bg-amber-500/10 border-b border-amber-500/20 flex items-center justify-between">
            <span className="font-semibold text-sm text-amber-700 dark:text-amber-300 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
              In Preparation
            </span>
            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-bold">
              {inPrep.length}
            </span>
          </div>

          <div className="p-3 space-y-3 flex-1 overflow-y-auto max-h-[720px]">
            {inPrep.length === 0 ? (
              <p className="text-center py-12 text-xs text-muted-foreground">Kitchen is idle. Start a new ticket to see it here.</p>
            ) : (
              inPrep.map((order) => {
                const sla = getSlaInfo(order.createdAt);
                const allItemsDone = order.items.length > 0 && order.items.every((i) => i.isCompleted);

                return (
                  <div
                    key={order.id}
                    className={`p-4 rounded-xl bg-background border shadow-sm space-y-3 ${
                      sla.level === "BREACH"
                        ? sla.cardBorder
                        : allItemsDone
                        ? "border-emerald-500/80 ring-1 ring-emerald-500/30"
                        : "border-amber-500/40"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-xs font-mono font-bold text-amber-700 dark:text-amber-300 block">{order.orderNumber}</span>
                        <span className="font-semibold text-sm text-foreground">{order.customerName}</span>
                      </div>
                      <span className={`text-[11px] px-2 py-0.5 rounded ${sla.badgeClass}`}>
                        {sla.label}
                      </span>
                    </div>

                    {/* Dining Mode & Pickup */}
                    <div className="flex items-center justify-between gap-2 text-xs flex-wrap">
                      <div className="flex items-center gap-1.5">
                        {order.diningMode === "DINE_IN" ? (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/30">
                            🍽️ Table {order.tableNumber || "Dine-In"}
                          </span>
                        ) : (
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                            🛍️ Takeaway
                          </span>
                        )}
                        {order.tip && Number(order.tip) > 0 && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                            Tip: ₹{Number(order.tip).toFixed(0)}
                          </span>
                        )}
                      </div>
                      <span className="text-muted-foreground">
                        Pickup: <strong className="text-foreground">{order.pickupTime}</strong>
                      </span>
                    </div>

                    {/* Interactive Line-Item Bumping Checklist */}
                    <div className="space-y-1.5 pt-2 border-t border-border">
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground font-semibold px-1">
                        <span>Line Items (tap to bump)</span>
                        <span>
                          {order.items.filter((i) => i.isCompleted).length} / {order.items.length} done
                        </span>
                      </div>

                      {order.items.map((item) => {
                        const isCurrentStation =
                          selectedStation === "ALL" ||
                          (item.station || "HOT_KITCHEN") === selectedStation;

                        return (
                          <button
                            key={item.id}
                            type="button"
                            disabled={!canManage}
                            aria-pressed={!!item.isCompleted}
                            onClick={() => handleToggleItemBump(order.id, item.id, !item.isCompleted)}
                            className={`w-full text-left p-2 rounded-lg border transition-all flex flex-col gap-1 ${
                              item.isCompleted
                                ? "bg-emerald-500/10 border-emerald-500/30 text-muted-foreground"
                                : isCurrentStation
                                ? "bg-card border-border hover:border-primary/50 text-foreground cursor-pointer"
                                : "bg-muted/30 border-dashed border-border opacity-60 text-muted-foreground"
                            }`}
                          >
                            <div className="flex items-center justify-between text-xs">
                              <span className="flex items-center gap-2 font-medium">
                                <span
                                  className={`w-4 h-4 rounded flex items-center justify-center text-[10px] font-bold border transition-colors ${
                                    item.isCompleted
                                      ? "bg-success border-success text-background"
                                      : "border-muted-foreground/40 bg-background text-transparent"
                                  }`}
                                >
                                  ✓
                                </span>
                                <span className={item.isCompleted ? "line-through text-muted-foreground" : ""}>
                                  [ {item.quantity}x ] {item.dishName}
                                </span>
                              </span>
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded font-mono uppercase ${
                                  isCurrentStation
                                    ? "bg-primary/15 text-primary border border-primary/25 font-bold"
                                    : "bg-muted text-muted-foreground"
                                }`}
                              >
                                {(item.station || "HOT").replace("_", " ")}
                              </span>
                            </div>
                            {item.modifiers && item.modifiers.length > 0 && (
                              <div className="pl-6 space-y-0.5">
                                {item.modifiers.map((m, mIdx) => (
                                  <div key={mIdx} className="text-[11px] text-muted-foreground flex items-center gap-1">
                                    <span className="text-primary/70">↳</span>
                                    <span>{m.optionName}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {allItemsDone && (
                      <div className="p-2 rounded bg-emerald-500/15 border border-emerald-500/30 text-xs font-semibold text-emerald-700 dark:text-emerald-300 text-center flex items-center justify-center gap-1.5">
                        <span>✨ All items bumped! Ready to dispatch.</span>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => printChit(order)}
                        className="px-2.5 py-2 rounded-lg text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground border border-border transition-colors flex items-center gap-1"
                        title="Print Kitchen Expedite Chit (80mm)"
                      >
                        🖨️ Chit
                      </button>
                      <button
                        type="button"
                        disabled={isPending || !canManage}
                        onClick={() => handleAdvanceStatus(order.id, "READY")}
                        className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-colors shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-60 ${
                          allItemsDone
                            ? "bg-success hover:bg-success/90 text-background ring-2 ring-success/50"
                            : "bg-primary hover:bg-primary/90 text-primary-foreground"
                        }`}
                      >
                        🔔 Mark ready for pass
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Column 3: Ready for Pickup / Pass */}
        <div className="flex flex-col rounded-2xl bg-card border border-emerald-500/30 overflow-hidden shadow-sm">
          <div className="px-4 py-3 bg-emerald-500/10 border-b border-emerald-500/20 flex items-center justify-between">
            <span className="font-semibold text-sm text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              Ready at Pass
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
              {readyOrders.length}
            </span>
          </div>

          <div className="p-3 space-y-3 flex-1 overflow-y-auto max-h-[720px]">
            {readyOrders.length === 0 ? (
              <p className="text-center py-12 text-xs text-muted-foreground">No orders awaiting pickup. Mark a ticket ready to send it to the pass.</p>
            ) : (
              readyOrders.map((order) => (
                <div
                  key={order.id}
                  className="p-4 rounded-xl bg-background border border-emerald-500/40 shadow-sm space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-300 block">{order.orderNumber}</span>
                      <span className="font-semibold text-sm text-foreground">{order.customerName}</span>
                    </div>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                      READY
                    </span>
                  </div>

                  {/* Dining Mode */}
                  <div className="flex items-center justify-between gap-2 text-xs flex-wrap">
                    <div className="flex items-center gap-1.5">
                      {order.diningMode === "DINE_IN" ? (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/30">
                          🍽️ Table {order.tableNumber || "Dine-In"}
                        </span>
                      ) : (
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                          🛍️ Takeaway
                        </span>
                      )}
                    </div>
                    <span className="text-muted-foreground">
                      Pickup: <strong className="text-foreground">{order.pickupTime}</strong>
                    </span>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-border">
                    {order.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between text-xs">
                        <span className="text-foreground font-medium flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-[10px] font-bold">
                            {item.quantity}
                          </span>
                          {item.dishName}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {(item.station || "HOT").replace("_", " ")}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => printChit(order)}
                      className="px-2.5 py-2 rounded-lg text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground border border-border transition-colors flex items-center gap-1"
                      title="Print Kitchen Expedite Chit (80mm)"
                    >
                      🖨️ Chit
                    </button>
                    <button
                      type="button"
                      disabled={isPending || !canManage}
                      onClick={() => handleAdvanceStatus(order.id, "COMPLETED")}
                      className="flex-1 py-1.5 px-3 rounded-lg text-xs font-bold bg-success hover:bg-success/90 text-background transition-colors shadow-sm disabled:opacity-60 flex items-center justify-center gap-1.5"
                    >
                      ✓ Handed Over & Complete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column 4: Completed */}
        <div className="flex flex-col rounded-2xl bg-card border border-border overflow-hidden shadow-sm opacity-80">
          <div className="px-4 py-3 bg-muted/30 border-b border-border flex items-center justify-between">
            <span className="font-semibold text-sm text-muted-foreground">Completed (Recent)</span>
            <span className="px-2 py-0.5 rounded-full bg-muted text-foreground text-xs font-bold">
              {completedOrders.length}
            </span>
          </div>

          <div className="p-3 space-y-3 flex-1 overflow-y-auto max-h-[720px]">
            {completedOrders.length === 0 ? (
              <p className="text-center py-12 text-xs text-muted-foreground">No completed orders yet. Handed-over tickets show here.</p>
            ) : (
              completedOrders.map((order) => (
                <div key={order.id} className="p-3 rounded-xl bg-background border border-border space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-muted-foreground">{order.orderNumber}</span>
                    <span className="text-[10px] text-muted-foreground">{order.customerName}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {order.items.map((i) => `${i.quantity}x ${i.dishName}`).join(", ")}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
