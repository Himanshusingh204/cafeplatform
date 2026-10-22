import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * `server/app.ts` registers the SSE and telemetry routes on the shared Express
 * app. These are source-level regression guards
 * for the auth posture of the SSE and telemetry routes, which previously leaked
 * every tenant's order stream / process internals to anonymous callers.
 */
const source = readFileSync(resolve(process.cwd(), "server/app.ts"), "utf8");

function routeBlock(route: string): string {
  const start = source.indexOf(`app.get("${route}"`);
  expect(start, `route ${route} not found`).toBeGreaterThan(-1);

  const nextRoute = source.indexOf("\napp.", start + 1);
  return source.slice(start, nextRoute === -1 ? undefined : nextRoute);
}

describe("Express KDS + metrics auth", () => {
  it("guards the KDS SSE stream with orders:read", () => {
    expect(routeBlock("/api/v1/realtime/kds")).toContain('adaptRequest(req, "orders:read")');
  });

  it("does not fall back to a default tenant for anonymous KDS clients", () => {
    const block = routeBlock("/api/v1/realtime/kds");
    expect(block).not.toContain("getOrCreateDefaultTenant");
    expect(block).not.toContain("defaultTenant");
    expect(source).not.toContain("getOrCreateDefaultTenant");
  });

  it("guards the system metrics endpoint with orders:read", () => {
    expect(routeBlock("/api/v1/system/metrics")).toContain('adaptRequest(req, "orders:read")');
  });

  it("returns 401 rather than streaming when authentication fails", () => {
    for (const route of ["/api/v1/realtime/kds", "/api/v1/system/metrics"]) {
      const block = routeBlock(route);
      expect(block).toContain("auth.success");
      expect(block).toContain("res.status(auth.status)");
    }
    // The KDS stream must not flush SSE headers before auth has passed.
    const kds = routeBlock("/api/v1/realtime/kds");
    expect(kds.indexOf('adaptRequest(req, "orders:read")')).toBeLessThan(
      kds.indexOf("res.flushHeaders()")
    );
  });
});
