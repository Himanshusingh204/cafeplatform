import { EventEmitter } from "node:events";

export type RealtimeEventType =
  | "order:created"
  | "order:status_changed"
  | "reservation:created"
  | "kds:ticket_updated";

export interface RealtimeEventPayload {
  type: RealtimeEventType;
  tenantId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

// Global EventEmitter instance preserved across hot-reloads in Next.js development
declare global {
  var __realtimeBus: EventEmitter | undefined;
}

const bus = globalThis.__realtimeBus ?? new EventEmitter();
bus.setMaxListeners(100);

if (process.env.NODE_ENV !== "production") {
  globalThis.__realtimeBus = bus;
}

/**
 * Broadcasts a real-time event to all connected listeners (KDS, WebSockets, SSE).
 */
export function broadcastEvent(event: RealtimeEventPayload): void {
  const channel = `tenant:${event.tenantId}`;
  bus.emit(channel, event);
  bus.emit("all", event);
}

/**
 * Subscribes to events for a specific tenant.
 * Returns an unsubscribe function.
 */
export function subscribeToTenantEvents(
  tenantId: string,
  handler: (event: RealtimeEventPayload) => void
): () => void {
  const channel = `tenant:${tenantId}`;
  bus.on(channel, handler);
  return () => {
    bus.off(channel, handler);
  };
}
