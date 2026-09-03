import { db } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await getSession();
  if (!admin) {
    return new Response("Unauthorized", { status: 401 });
  }

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

      // Cleanup after 5 minutes (prevent infinite connections)
      const timeout = setTimeout(() => {
        clearInterval(interval);
        clearInterval(heartbeat);
        controller.close();
      }, 5 * 60 * 1000);

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
