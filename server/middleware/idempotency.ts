import { Request, Response, NextFunction } from "express";
import { globalIdempotency } from "@/lib/resilience/idempotency";

export function idempotencyMiddleware(ttlSeconds: number = 86400) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Only apply to mutating requests
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
      next();
      return;
    }

    const rawKey = req.headers["idempotency-key"] || req.headers["x-idempotency-key"];
    const key = Array.isArray(rawKey) ? rawKey[0] : rawKey;

    if (!key || typeof key !== "string" || key.trim() === "") {
      next();
      return;
    }

    const trimmedKey = key.trim();

    try {
      const result = await globalIdempotency.acquire(trimmedKey, ttlSeconds);

      if (result.status === "completed") {
        res.setHeader("X-Cache-Lookup", "HIT-IDEMPOTENT");
        if (result.response.headers) {
          for (const [headerKey, headerVal] of Object.entries(result.response.headers)) {
            if (!["transfer-encoding", "content-length", "connection"].includes(headerKey.toLowerCase())) {
              res.setHeader(headerKey, headerVal);
            }
          }
        }
        res.status(result.response.statusCode).json(result.response.body);
        return;
      }

      if (result.status === "in_flight") {
        res.setHeader("Retry-After", "1");
        res.status(409).json({
          error: "Conflict: A request with this Idempotency-Key is currently in-flight.",
          retryAfterSeconds: 1,
        });
        return;
      }

      // Intercept res.json / res.send to store completed response
      const originalJson = res.json.bind(res);
      const originalSend = res.send.bind(res);

      let finished = false;

      const captureAndStore = async (body: unknown, statusCode: number) => {
        if (finished) return;
        finished = true;

        if (statusCode >= 200 && statusCode < 400) {
          await globalIdempotency.complete(
            trimmedKey,
            {
              statusCode,
              body,
              timestamp: new Date().toISOString(),
            },
            ttlSeconds
          );
        } else {
          // If the request resulted in a client or server error, release the lock so caller can retry
          await globalIdempotency.release(trimmedKey);
        }
      };

      res.json = (body: unknown): Response => {
        captureAndStore(body, res.statusCode).catch((err) => {
          console.error("[Idempotency] Failed to store response:", err);
        });
        return originalJson(body);
      };

      res.send = (body: unknown): Response => {
        captureAndStore(body, res.statusCode).catch((err) => {
          console.error("[Idempotency] Failed to store response:", err);
        });
        return originalSend(body);
      };

      next();
    } catch (err) {
      console.error("[Idempotency] Middleware error:", err);
      next();
    }
  };
}
