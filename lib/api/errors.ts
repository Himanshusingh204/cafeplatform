import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

/** Stable machine-readable error codes. Additive to the legacy `{ error }` body. */
export type ApiErrorCode =
  | "unauthorized"
  | "forbidden"
  | "invalid_request"
  | "rate_limited"
  | "plan_limit_exceeded"
  | "conflict"
  | "not_found"
  | "service_unavailable"
  | "internal_error";

export function codeForStatus(status: number): ApiErrorCode {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 402) return "plan_limit_exceeded";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (status === 429) return "rate_limited";
  if (status === 503) return "service_unavailable";
  if (status >= 500) return "internal_error";
  return "invalid_request";
}

export interface ApiErrorExtra {
  /** Source request, used to echo its x-request-id. */
  request?: Request;
  /** Extra response headers (e.g. Retry-After). */
  headers?: HeadersInit;
  /** Any other keys are merged into the JSON body (e.g. details). */
  [key: string]: unknown;
}

const SAFE_ID = /^[A-Za-z0-9._-]{1,128}$/;

export function resolveRequestId(request?: Request): string {
  const incoming = request?.headers.get("x-request-id")?.trim();
  if (incoming && SAFE_ID.test(incoming)) return incoming;
  return crypto.randomUUID();
}

/** Runtime-agnostic error body shared by the Next and Express adapters. */
export function buildErrorBody(
  status: number,
  message: string,
  code: ApiErrorCode = codeForStatus(status),
  extra: Record<string, unknown> = {},
  request?: Request
) {
  const requestId = resolveRequestId(request);
  return { requestId, body: { ...extra, error: message, code, requestId } };
}

/**
 * Build an error response. The body keeps the legacy `error` string and adds
 * `code` and `requestId`; the id is also returned as `x-request-id`.
 */
export function apiError(
  status: number,
  message: string,
  code: ApiErrorCode = codeForStatus(status),
  extra: ApiErrorExtra = {}
) {
  const { request, headers, ...rest } = extra;
  const { requestId, body } = buildErrorBody(status, message, code, rest, request);
  if (status >= 500) logger.error({ event: "api.error", requestId, status, message });
  const res = NextResponse.json(body, { status, headers });
  res.headers.set("x-request-id", requestId);
  return res;
}
