import type { Request as ExpressRequest } from "express";
import { verifyS2SRequest, type ApiScope } from "@/lib/auth/s2s";

/** Rebuild a Fetch API Request from an Express request (headers and URL only). */
export function toWebRequest(req: ExpressRequest): Request {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (value) headers.set(name, Array.isArray(value) ? value[0] : value);
  }
  // Overwrite any client-sent value with Express's resolved address (honours `trust proxy`),
  // so the API-key IP allowlist sees the real caller and cannot be spoofed.
  if (req.ip) headers.set("x-forwarded-for", req.ip);
  else headers.delete("x-forwarded-for");
  headers.delete("x-real-ip");
  return new globalThis.Request(`http://localhost${req.originalUrl}`, {
    method: req.method,
    headers,
  });
}

/** Run the shared S2S verifier against an Express request. */
export function verifyExpressS2S(req: ExpressRequest, scope: ApiScope) {
  return verifyS2SRequest(toWebRequest(req), scope);
}
