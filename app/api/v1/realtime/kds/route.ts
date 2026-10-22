import { getSession } from "@/lib/auth/session";
import { verifyS2SRequest } from "@/lib/auth/s2s";
import { getAdminTenantId } from "@/lib/auth/tenant-context";
import { subscribeToTenantEvents, RealtimeEventPayload } from "@/lib/realtime/bus";

export const dynamic = "force-dynamic";

/**
 * The kitchen stream is long-lived by design, so the duration budget is stated
 * explicitly rather than inherited silently. 300 s is both the platform default
 * and the maximum on Hobby; Pro and Enterprise may raise it to 800 s. See
 * `config/limits.ts` (`sse`) for the shared budget.
 *
 * Consequence to keep in mind: whatever the cap, the stream is eventually cut,
 * and this handler sends no `id:` field, so a reconnecting `EventSource` cannot
 * resume — tickets raised during the gap are not replayed. Durable fan-out and
 * replay arrive with the Redis-backed bus (roadmap Phase 3).
 */
export const maxDuration = 300;

/**
 * GET /api/v1/realtime/kds
 * Bi-directional ready Real-Time SSE Stream for Kitchen Display Systems (KDS)
 * and live restaurant dispatch monitors.
 */
export async function GET(request: Request) {
  let tenantId: string;

  // 1. Try S2S API Key authentication (e.g. from hardware POS terminal or dedicated kitchen tablet)
  const url = new URL(request.url);
  const tokenFromQuery = url.searchParams.get("token");

  if (tokenFromQuery || request.headers.has("authorization") || request.headers.has("x-api-key")) {
    const mockRequest = tokenFromQuery
      ? new Request(request.url, { headers: { authorization: `Bearer ${tokenFromQuery}` } })
      : request;

    const s2s = await verifyS2SRequest(mockRequest, "orders:read");
    if (!s2s.success) {
      return new Response(JSON.stringify({ error: s2s.error }), {
        status: s2s.status,
        headers: { "Content-Type": "application/json" },
      });
    }
    tenantId = s2s.context.tenantId;
  } else {
    // 2. Fallback to Admin Cookie Session (for in-browser /admin/kds dashboard)
    const admin = await getSession();
    if (!admin) {
      return new Response("Unauthorized", { status: 401 });
    }
    tenantId = await getAdminTenantId(admin);
  }

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let heartbeatTimer: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // Handshake
      controller.enqueue(
        encoder.encode(`event: connected\ndata: ${JSON.stringify({ tenantId, timestamp: new Date().toISOString() })}\n\n`)
      );

      // Subscribe to real-time events on the bus
      unsubscribe = subscribeToTenantEvents(tenantId, (event: RealtimeEventPayload) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
          );
        } catch {
          // Client disconnected
        }
      });

      // Heartbeat ping every 20s
      heartbeatTimer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
        } catch {
          if (heartbeatTimer) clearInterval(heartbeatTimer);
        }
      }, 20_000);
    },
    cancel() {
      if (unsubscribe) unsubscribe();
      if (heartbeatTimer) clearInterval(heartbeatTimer);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
