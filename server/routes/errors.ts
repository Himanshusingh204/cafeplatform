import type { Request as ExpressRequest, Response as ExpressResponse } from "express";
import { buildErrorBody, type ApiErrorCode } from "@/lib/api/errors";

/**
 * Send the same `{ error, code, requestId }` envelope the Next routes return,
 * echoing a valid inbound `x-request-id`.
 */
export function sendError(
  req: ExpressRequest,
  res: ExpressResponse,
  status: number,
  message: string,
  code?: ApiErrorCode,
  extra: Record<string, unknown> = {}
): void {
  const inbound = req.headers["x-request-id"];
  const probe = new globalThis.Request("http://localhost/", {
    headers: typeof inbound === "string" ? { "x-request-id": inbound } : undefined,
  });
  const { requestId, body } = buildErrorBody(status, message, code, extra, probe);
  res.setHeader("x-request-id", requestId);
  res.status(status).json(body);
}
