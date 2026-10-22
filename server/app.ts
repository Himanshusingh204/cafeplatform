import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import { db } from "@/lib/db/prisma";
import { subscribeToTenantEvents, RealtimeEventPayload } from "@/lib/realtime/bus";
import { verifyRazorpayWebhookSignature } from "@/lib/payments/engine";
import { validateCoupon } from "@/lib/services/orders";
import { captureRejection } from "@/lib/payments/capture-guard";
import { logger } from "@/lib/logger";
import { OrderStatus } from "@/lib/generated/prisma/enums";
import { buildAllowedOrigins, buildCorsOptions } from "./middleware/cors";
import { idempotencyMiddleware } from "./middleware/idempotency";
import { healthRouter } from "./routes/health";
import { menuRouter } from "./routes/menu";
import { ordersRouter } from "./routes/orders";
import { sendError } from "./routes/errors";
import { verifyExpressS2S } from "./routes/s2s";
import { globalJobQueue } from "@/lib/queue/job-queue";
import "@/lib/queue/handlers";

/**
 * The Express application, constructed without listening so tests can import it.
 * `server/api.ts` is the process entry that binds the port.
 */
const app = express();
const PORT = process.env.API_PORT ? parseInt(process.env.API_PORT, 10) : 4000;
const CLIENT_URL = process.env.APP_URL || "http://localhost:3000";

// 1. CORS Configuration: strict env allow-list with credentials (server/middleware/cors.ts).
// Unknown browser origins get no CORS headers. Requests without an Origin
// (server-to-server, curl) are unaffected by CORS and stay allowed.
const allowedOrigins = buildAllowedOrigins();

app.disable("x-powered-by");
// Set TRUST_PROXY_HOPS to the number of reverse proxies in front (0 = none, req.ip is the socket address).
app.set("trust proxy", Number(process.env.TRUST_PROXY_HOPS ?? 0));

app.use(
  cors(
    buildCorsOptions(allowedOrigins, (origin) =>
      logger.warn({ event: "cors.origin_rejected", message: "Rejected request from non-allowlisted origin", origin })
    )
  )
);

// Baseline security headers for every response, including API errors. These do
// not buffer bodies, so SSE endpoints keep streaming normally.
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
  next();
});

// Capture raw body for webhook HMAC validation
app.use(
  express.json({
    verify: (req: Request & { rawBody?: string }, _res, buf) => {
      req.rawBody = buf.toString();
    },
  })
);

// Resilient Distributed Idempotency (Deduplicates concurrent mutating requests)
// Order creation is excluded: the route scopes its key by tenant and binds it to
// a payload fingerprint (same contract as the Next route), which this raw-key
// middleware cannot do before authentication.
const rawKeyIdempotency = idempotencyMiddleware(86400);
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.method === "POST" && req.path === "/api/v1/orders") {
    next();
    return;
  }
  return rawKeyIdempotency(req, res, next);
});

// 2. Health & Diagnostic Endpoints
app.use(healthRouter);

const adaptRequest = verifyExpressS2S;

// 3. Menu API (S2S, shared service with the Next route)
app.use("/api/v1/menu", menuRouter);

// 4. Coupons Validation API
app.post("/api/v1/coupons/validate", async (req: Request, res: Response) => {
  const { code, subtotal } = req.body;
  if (!code || typeof subtotal !== "number") {
    res.status(400).json({ valid: false, message: "Code and subtotal are required" });
    return;
  }

  const result = await validateCoupon(String(code), subtotal);
  res.json(result);
});

// 5. Orders API (S2S)
app.use("/api/v1/orders", ordersRouter);
app.get("/api/v1/orders", async (req: Request, res: Response) => {
  const auth = await adaptRequest(req, "orders:read");
  if (!auth.success) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  const tenantId = auth.context.tenantId;
  const status = req.query.status as string | undefined;

  const orders = await db.order.findMany({
    where: {
      tenantId,
      ...(status && Object.values(OrderStatus).includes(status as OrderStatus)
        ? { orderStatus: status as OrderStatus }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { items: true },
  });

  res.json({ tenantId, count: orders.length, orders });
});

// Single Order Query
app.get("/api/v1/orders/:id", async (req: Request, res: Response) => {
  const auth = await adaptRequest(req, "orders:read");
  if (!auth.success) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : String(rawId || "");
  const tenantId = auth.context.tenantId;

  const order = await db.order.findFirst({
    where: {
      OR: [{ id }, { orderNumber: id }],
      tenantId,
    },
    include: { items: true },
  });

  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  res.json({ order });
});

// 6. Real-Time KDS Stream (SSE)
// Requires a valid S2S key with orders:read. There is deliberately no
// anonymous/default-tenant fallback: it would stream every tenant's orders.
app.get("/api/v1/realtime/kds", async (req: Request, res: Response) => {
  const auth = await adaptRequest(req, "orders:read");
  if (!auth.success) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }
  const tenantId = auth.context.tenantId;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  res.write(`event: connected\ndata: ${JSON.stringify({ tenantId, port: PORT, timestamp: new Date().toISOString() })}\n\n`);

  const unsubscribe = subscribeToTenantEvents(tenantId, (event: RealtimeEventPayload) => {
    res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  });

  const heartbeat = setInterval(() => {
    res.write("event: ping\ndata: {}\n\n");
  }, 25000);

  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

// 7. Payment Webhook Ingress (Idempotent & Cryptographically Verified)
app.post("/api/v1/webhooks/payment", async (req: Request & { rawBody?: string }, res: Response) => {
  const signature = req.headers["x-razorpay-signature"] as string | undefined;
  const rawBody = req.rawBody || JSON.stringify(req.body);

  if (process.env.NODE_ENV === "production" || process.env.RAZORPAY_WEBHOOK_SECRET) {
    if (!signature || !verifyRazorpayWebhookSignature(rawBody, signature)) {
      res.status(400).json({ error: "Invalid signature" });
      return;
    }
  }

  const payload = req.body || {};
  const eventType = String(payload.event || "");
  const payloadData = payload.payload || {};
  const paymentObj = payloadData.payment?.entity || {};

  const gatewayOrderId = String(paymentObj.order_id || "");
  const appOrderId = paymentObj.notes?.appOrderId;

  if (eventType === "payment.captured" || eventType === "order.paid") {
    if (!appOrderId && !gatewayOrderId) {
      res.status(200).json({ received: true, note: "No order identifiers found" });
      return;
    }

    const order = await db.order.findFirst({
      where: {
        OR: [
          ...(appOrderId ? [{ id: appOrderId }] : []),
          ...(gatewayOrderId ? [{ gatewayOrderId }] : []),
        ],
      },
    });

    const rejection = order ? captureRejection(order, paymentObj.amount) : null;
    if (rejection) {
      logger.error({
        event: "webhook.payment.rejected",
        orderId: order?.id,
        paymentId: paymentObj.id,
        amount: paymentObj.amount,
        reason: rejection,
      });
    } else if (order && order.paymentStatus !== "PAID") {
      // Conditional update: a concurrent duplicate delivery matches 0 rows and does nothing.
      const claimed = await db.order.updateMany({
        where: { id: order.id, paymentStatus: { not: "PAID" } },
        data: { paymentStatus: "PAID", orderStatus: "CONFIRMED" },
      });
      if (claimed.count === 0) {
        res.status(200).json({ received: true, note: "Already processed" });
        return;
      }

      // Decoupled asynchronous workers via JobQueue
      globalJobQueue.enqueue("KDS_BROADCAST", {
        type: "order:status_changed",
        tenantId: order.tenantId, // tenant UUID (matches the KDS subscriber), never a slug
        timestamp: new Date().toISOString(),
        data: { id: order.id, orderNumber: order.orderNumber, orderStatus: "CONFIRMED", paymentStatus: "PAID" },
      });

      if (order.customerEmail) {
        globalJobQueue.enqueue("EMAIL_DISPATCH", {
          to: order.customerEmail,
          subject: `Order Confirmation #${order.orderNumber} - Spice & Saffron`,
          body: `Thank you for your order! Your payment has been confirmed.`,
          orderNumber: order.orderNumber,
        });
      }
    }
  }

  res.status(200).json({ received: true });
});

// 8. System & Telemetry Metrics (S2S / Ops)
app.get("/api/v1/system/metrics", async (req: Request, res: Response) => {
  const auth = await adaptRequest(req, "orders:read");
  if (!auth.success) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    memoryUsage: process.memoryUsage(),
    queue: globalJobQueue.getMetrics(),
  });
});

// Malformed JSON bodies get the same envelope the Next route returns.
app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof SyntaxError && "body" in err) {
    sendError(req, res, 400, "Invalid JSON payload");
    return;
  }
  next(err);
});

export { app, PORT, CLIENT_URL };
export default app;
