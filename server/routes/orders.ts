import { Router } from "express";
import {
  acquireIdempotency,
  applyRateLimit,
  completeIdempotency,
  hashPayload,
  idempotencyScope,
  readIdempotencyKey,
  releaseIdempotency,
  requiresDistributedBackend,
} from "@/lib/api/request-guards";
import { createOrderSchema } from "@/lib/api/order-schema";
import { createOrder, OrderValidationError } from "@/lib/services/orders";
import { PlanLimitError } from "@/lib/plans";
import { sendError } from "./errors";
import { toWebRequest, verifyExpressS2S } from "./s2s";

export const ordersRouter = Router();

const ORDER_RATE_LIMIT_MAX = 60;
const ORDER_RATE_LIMIT_WINDOW_MS = 60_000;

/**
 * POST /api/v1/orders - same guard order and error mapping as the Next route:
 * authenticate, fail closed without a shared backend, validate, rate limit,
 * deduplicate, then delegate all pricing to the shared createOrder service.
 */
ordersRouter.post("/", async (req, res) => {
  const auth = await verifyExpressS2S(req, "orders:write");
  if (!auth.success) {
    sendError(req, res, auth.status, auth.error);
    return;
  }

  if (requiresDistributedBackend()) {
    sendError(
      req,
      res,
      503,
      "Order ingestion is unavailable: shared rate-limit and idempotency storage is not configured."
    );
    return;
  }

  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    sendError(req, res, 422, "Validation failed", "invalid_request", {
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const limit = await applyRateLimit(
    `orders:create:${auth.context.id}`,
    ORDER_RATE_LIMIT_MAX,
    ORDER_RATE_LIMIT_WINDOW_MS
  );
  if (!limit.success) {
    res.setHeader("Retry-After", String(Math.max(1, Math.ceil(limit.retryAfterMs / 1000))));
    sendError(req, res, 429, "Too many order requests. Please retry shortly.");
    return;
  }

  const idempotencyKey = readIdempotencyKey(toWebRequest(req));
  const payloadHash = hashPayload(parsed.data);
  const scope = idempotencyKey
    ? idempotencyScope(auth.context.tenantId, "orders.create", idempotencyKey)
    : null;

  if (scope) {
    const acquisition = await acquireIdempotency(scope, payloadHash);

    if (acquisition.status === "replay") {
      res.setHeader("Idempotent-Replay", "true");
      res.status(acquisition.response.statusCode).json(acquisition.response.body);
      return;
    }
    if (acquisition.status === "in_flight") {
      res.setHeader("Retry-After", "1");
      sendError(req, res, 409, "A request with this Idempotency-Key is already in flight.");
      return;
    }
    if (acquisition.status === "conflict") {
      sendError(
        req,
        res,
        409,
        "This Idempotency-Key was already used for a different request body. Use a new key for a new order."
      );
      return;
    }
  }

  try {
    const order = await createOrder({
      ...parsed.data,
      tenantId: auth.context.tenantId,
      allowAdHoc: true,
    });

    const responseBody = { message: "Order successfully ingested", order };
    if (scope) {
      await completeIdempotency(scope, 201, responseBody, payloadHash);
    }
    res.status(201).json(responseBody);
  } catch (error) {
    if (scope) {
      await releaseIdempotency(scope);
    }
    if (error instanceof OrderValidationError) {
      sendError(req, res, 422, error.message, "invalid_request");
      return;
    }
    if (error instanceof PlanLimitError) {
      sendError(req, res, 402, error.message, "plan_limit_exceeded");
      return;
    }
    console.error("Order ingestion failed:", error);
    sendError(req, res, 500, "Unable to create order");
  }
});
