"use client";

import { useEffect, useState, useTransition, useCallback } from "react";
import { updateOrderStatusAction, getActiveKDSOrdersAction } from "@/app/admin/actions/orders";
import type { OrderStatus } from "@/lib/generated/prisma/enums";

export interface KDSTicketItem {
  id: string;
  dishName: string;
  quantity: number;
  price: string | number;
}

export interface KDSTicket {
  id: string;
  orderNumber: string;
  customerName: string;
  pickupTime: string;
  specialInstructions?: string | null;
  total: string | number;
  orderStatus: "PENDING" | "CONFIRMED" | "PREPARING" | "READY" | "COMPLETED" | "CANCELLED";
  createdAt: string | Date;
  items: KDSTicketItem[];
}

interface KDSBoardProps {
  initialOrders: KDSTicket[];
}

export function KDSBoard({ initialOrders }: KDSBoardProps) {
  const [orders, setOrders] = useState<KDSTicket[]>(initialOrders);
  const [isConnected, setIsConnected] = useState(false);
  const [lastPing, setLastPing] = useState<string>("Connecting...");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [isPending, startTransition] = useTransition();

  // Keep now updated every 30 seconds for elapsed time rendering
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
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
    // Optimistic UI update
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, orderStatus: nextStatus } : o))
    );

    startTransition(async () => {
      await updateOrderStatusAction(orderId, nextStatus as OrderStatus);
    });
  };

  // Categorize columns
  const newOrders = orders.filter((o) => o.orderStatus === "PENDING");
  const inPrep = orders.filter((o) => o.orderStatus === "PREPARING" || o.orderStatus === "CONFIRMED");
  const readyOrders = orders.filter((o) => o.orderStatus === "READY");
  const completedOrders = orders.filter((o) => o.orderStatus === "COMPLETED").slice(0, 10);

  const getElapsedTime = (dateString: string | Date) => {
    const diffMin = Math.floor((now - new Date(dateString).getTime()) / 60000);
    if (diffMin <= 0) return "Just now";
    return `${diffMin}m ago`;
  };

  return (
    <div className="space-y-6">
      {/* KDS Header Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-card border border-border">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold font-serif text-foreground">Kitchen Display System (KDS)</h1>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                isConnected
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                  : "bg-amber-500/10 text-amber-400 border border-amber-500/30"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`}
              />
              {isConnected ? "Live WebSocket / SSE" : lastPing}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time kitchen order dispatch and fulfillment board. Orders advance automatically without reload.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
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

      {/* 4 Kanban Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {/* Column 1: New Orders */}
        <div className="flex flex-col rounded-2xl bg-card border border-rose-500/30 overflow-hidden shadow-sm">
          <div className="px-4 py-3 bg-rose-500/10 border-b border-rose-500/20 flex items-center justify-between">
            <span className="font-semibold text-sm text-rose-400 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
              Incoming New Orders
            </span>
            <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-xs font-bold">
              {newOrders.length}
            </span>
          </div>

          <div className="p-3 space-y-3 flex-1 overflow-y-auto max-h-[720px]">
            {newOrders.length === 0 ? (
              <p className="text-center py-12 text-xs text-muted-foreground">No new tickets.</p>
            ) : (
              newOrders.map((order) => (
                <div
                  key={order.id}
                  className="p-4 rounded-xl bg-background border-2 border-rose-500/40 shadow-sm space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-mono font-bold text-rose-400 block">{order.orderNumber}</span>
                      <span className="font-semibold text-sm text-foreground">{order.customerName}</span>
                    </div>
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground">
                      {getElapsedTime(order.createdAt)}
                    </span>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    <span>Pickup: <strong className="text-foreground">{order.pickupTime}</strong></span>
                  </div>

                  {/* Items List */}
                  <div className="space-y-1.5 pt-2 border-t border-border">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs">
                        <span className="text-foreground font-medium flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-300 flex items-center justify-center text-[10px] font-bold">
                            {item.quantity}
                          </span>
                          {item.dishName}
                        </span>
                      </div>
                    ))}
                  </div>

                  {order.specialInstructions && (
                    <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300">
                      ⚠️ {order.specialInstructions}
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleAdvanceStatus(order.id, "PREPARING")}
                    className="w-full py-2 px-3 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-colors shadow-sm flex items-center justify-center gap-1.5"
                  >
                    🔥 Start Cooking
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column 2: In Preparation */}
        <div className="flex flex-col rounded-2xl bg-card border border-amber-500/30 overflow-hidden shadow-sm">
          <div className="px-4 py-3 bg-amber-500/10 border-b border-amber-500/20 flex items-center justify-between">
            <span className="font-semibold text-sm text-amber-400 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              In Preparation
            </span>
            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold">
              {inPrep.length}
            </span>
          </div>

          <div className="p-3 space-y-3 flex-1 overflow-y-auto max-h-[720px]">
            {inPrep.length === 0 ? (
              <p className="text-center py-12 text-xs text-muted-foreground">Kitchen is idle.</p>
            ) : (
              inPrep.map((order) => (
                <div
                  key={order.id}
                  className="p-4 rounded-xl bg-background border border-amber-500/40 shadow-sm space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-mono font-bold text-amber-400 block">{order.orderNumber}</span>
                      <span className="font-semibold text-sm text-foreground">{order.customerName}</span>
                    </div>
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-amber-500/10 text-amber-400">
                      {getElapsedTime(order.createdAt)}
                    </span>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-border">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs">
                        <span className="text-foreground font-medium flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center text-[10px] font-bold">
                            {item.quantity}
                          </span>
                          {item.dishName}
                        </span>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleAdvanceStatus(order.id, "READY")}
                    className="w-full py-2 px-3 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white transition-colors shadow-sm flex items-center justify-center gap-1.5"
                  >
                    🔔 Mark Ready for Pass
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column 3: Ready for Pickup / Pass */}
        <div className="flex flex-col rounded-2xl bg-card border border-emerald-500/30 overflow-hidden shadow-sm">
          <div className="px-4 py-3 bg-emerald-500/10 border-b border-emerald-500/20 flex items-center justify-between">
            <span className="font-semibold text-sm text-emerald-400 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              Ready at Pass
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold">
              {readyOrders.length}
            </span>
          </div>

          <div className="p-3 space-y-3 flex-1 overflow-y-auto max-h-[720px]">
            {readyOrders.length === 0 ? (
              <p className="text-center py-12 text-xs text-muted-foreground">No orders awaiting pickup.</p>
            ) : (
              readyOrders.map((order) => (
                <div
                  key={order.id}
                  className="p-4 rounded-xl bg-background border border-emerald-500/40 shadow-sm space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-mono font-bold text-emerald-400 block">{order.orderNumber}</span>
                      <span className="font-semibold text-sm text-foreground">{order.customerName}</span>
                    </div>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                      READY
                    </span>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-border">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs">
                        <span className="text-foreground font-medium flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center text-[10px] font-bold">
                            {item.quantity}
                          </span>
                          {item.dishName}
                        </span>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleAdvanceStatus(order.id, "COMPLETED")}
                    className="w-full py-2 px-3 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-sm flex items-center justify-center gap-1.5"
                  >
                    ✓ Handed Over & Complete
                  </button>
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
              <p className="text-center py-12 text-xs text-muted-foreground">No completed orders yet.</p>
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
