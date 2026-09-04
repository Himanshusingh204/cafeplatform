import "./preload";
import express, { Request, Response } from "express";
import cors from "cors";
import { db } from "@/lib/db/prisma";
import { verifyS2SRequest, ApiScope } from "@/lib/auth/s2s";
import { broadcastEvent, subscribeToTenantEvents, RealtimeEventPayload } from "@/lib/realtime/bus";
import { getOrCreateDefaultTenant } from "@/lib/db/tenant";
import { verifyRazorpayWebhookSignature } from "@/lib/payments/engine";
import { validateCoupon } from "@/lib/services/orders";
import { logger } from "@/lib/logger";
import { OrderStatus } from "@/lib/generated/prisma/enums";

const app = express();
const PORT = process.env.API_PORT ? parseInt(process.env.API_PORT, 10) : 4000;
const CLIENT_URL = process.env.APP_URL || "http://localhost:3000";

// 1. CORS Configuration (Allows Frontend on Port 3000)
const allowedOrigins = [
  CLIENT_URL,
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3001",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, true); // Permissive in dev, restrict in prod
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Api-Key", "X-Razorpay-Signature"],
  })
);

// Capture raw body for webhook HMAC validation
app.use(
  express.json({
    verify: (req: Request & { rawBody?: string }, _res, buf) => {
      req.rawBody = buf.toString();
    },
  })
);

// 2. Health & Diagnostic Endpoints
app.get(["/health", "/api/health"], async (_req: Request, res: Response) => {
  try {
    await db.$queryRaw`SELECT 1`;
    res.json({
      status: "healthy",
      service: "spice-saffron-backend-api",
      port: PORT,
      timestamp: new Date().toISOString(),
      database: "connected",
    });
  } catch {
    res.status(503).json({
      status: "unhealthy",
      service: "spice-saffron-backend-api",
      port: PORT,
      error: "Database unreachable",
    });
  }
});

// Helper for S2S header adaptation
function adaptRequest(req: Request, requiredScope: ApiScope) {
  const headers = new Headers();
  Object.entries(req.headers).forEach(([k, v]) => {
    if (v) headers.set(k, Array.isArray(v) ? v[0] : v);
  });
  const mockReq = new globalThis.Request(`http://localhost:${PORT}${req.originalUrl}`, {
    method: req.method,
    headers,
  });
  return verifyS2SRequest(mockReq, requiredScope);
}

// 3. Menu API (Public & B2B)
app.get("/api/v1/menu", async (req: Request, res: Response) => {
  try {
    const categories = await db.category.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: { sortOrder: "asc" },
      include: {
        dishes: {
          where: { isAvailable: true, deletedAt: null },
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    res.json({
      count: categories.length,
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        dishes: c.dishes.map((d) => ({
          id: d.id,
          name: d.name,
          slug: d.slug,
          price: Number(d.price),
          description: d.description,
          image: d.image,
          isVegetarian: d.isVegetarian,
          isVegan: d.isVegan,
          isSpicy: d.isSpicy,
        })),
      })),
    });
  } catch (error) {
    console.error("Failed to load menu:", error);
    res.status(500).json({ error: "Failed to load menu" });
  }
});

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
      OR: [{ tenantId }, { tenantId: null }],
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
      AND: [{ OR: [{ tenantId }, { tenantId: null }] }],
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
app.get("/api/v1/realtime/kds", async (req: Request, res: Response) => {
  let tenantId: string;
  const token = (req.query.token as string) || req.headers.authorization?.replace("Bearer ", "");

  if (token) {
    const auth = await adaptRequest(req, "orders:read");
    if (!auth.success) {
      res.status(auth.status).json({ error: auth.error });
      return;
    }
    tenantId = auth.context.tenantId;
  } else {
    const defaultTenant = await getOrCreateDefaultTenant();
    tenantId = defaultTenant.id;
  }

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

    if (order && order.paymentStatus !== "PAID") {
      await db.order.update({
        where: { id: order.id },
        data: { paymentStatus: "PAID", orderStatus: "CONFIRMED" },
      });

      broadcastEvent({
        type: "order:status_changed",
        tenantId: order.tenantId || "spice-saffron",
        timestamp: new Date().toISOString(),
        data: { id: order.id, orderNumber: order.orderNumber, orderStatus: "CONFIRMED", paymentStatus: "PAID" },
      });
    }
  }

  res.status(200).json({ received: true });
});

// Start Server
const server = app.listen(PORT, () => {
  logger.info({
    event: "backend.started",
    message: `🚀 Standalone Spice & Saffron Backend API active on http://localhost:${PORT}`,
    allowedOrigin: CLIENT_URL,
  });
});

process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
});

export default app;
