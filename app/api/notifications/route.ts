import { db } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { getAdminTenantId } from "@/lib/auth/tenant-context";
import { sse } from "@/config/limits";

export const dynamic = "force-dynamic";

/**
 * This stream polls, so it closes itself rather than running forever. The
 * lifetime is kept below the function's duration cap so the client sees a
 * graceful end-of-stream and reconnects deliberately, instead of being severed
 * by the platform. See `config/limits.ts` (`sse`).
 */
export const maxDuration = 300;

export async function GET() {
  const admin = await getSession();
  if (!admin) {
    return new Response("Unauthorized", { status: 401 });
  }

  const tenantId = await getAdminTenantId(admin);
  const encoder = new TextEncoder();

  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode("data: connected\n\n"));

      let lastCheck = Date.now();

      const interval = setInterval(async () => {
        try {
          const newMessages = await db.contactMessage.count({
            where: {
              tenantId,
              status: "NEW",
              createdAt: { gt: new Date(lastCheck) },
            },
          });

          if (newMessages > 0) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "new_message", count: newMessages })}\n\n`)
            );
          }

          lastCheck = Date.now();
        } catch {
          // Silently ignore errors — SSE connection stays alive
        }
      }, 10_000);

      // Heartbeat every 30s to keep connection alive
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode("data: heartbeat\n\n"));
      }, 30_000);

      // Close before the function's duration cap so the client reconnects on
      // its own terms rather than being cut off mid-stream.
      const timeout = setTimeout(() => {
        clearInterval(interval);
        clearInterval(heartbeat);
        controller.close();
      }, sse.notificationStreamLifetimeMs);

      cleanup = () => {
        clearInterval(interval);
        clearInterval(heartbeat);
        clearTimeout(timeout);
      };
    },
    cancel() {
      if (cleanup) cleanup();
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
