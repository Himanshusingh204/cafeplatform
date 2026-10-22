import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const rateLimit = vi.hoisted(() => vi.fn());
vi.mock("@/lib/rate-limit/limiter", () => ({ rateLimit }));

import { POST } from "@/app/api/csp-report/route";
import nextConfig from "@/next.config";

function req(body: string, type = "application/csp-report", extra: Record<string, string> = {}) {
  return new Request("http://localhost/api/csp-report", {
    method: "POST",
    headers: { "content-type": type, ...extra },
    body,
  });
}

beforeEach(() => {
  rateLimit.mockReset();
  rateLimit.mockResolvedValue({ success: true, remaining: 1, retryAfterMs: 0 });
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("POST /api/csp-report", () => {
  it("accepts a legacy csp-report and returns 204", async () => {
    const body = JSON.stringify({ "csp-report": { "violated-directive": "script-src", "blocked-uri": "inline" } });
    expect((await POST(req(body))).status).toBe(204);
  });

  it("accepts a Reporting API payload", async () => {
    const body = JSON.stringify([{ type: "csp-violation", body: { effectiveDirective: "script-src", blockedURL: "inline" } }]);
    expect((await POST(req(body, "application/reports+json"))).status).toBe(204);
  });

  it("rejects wrong content type, bad shape, bad JSON and oversize bodies", async () => {
    expect((await POST(req("{}", "text/plain"))).status).toBe(415);
    expect((await POST(req(JSON.stringify({ hello: 1 })))).status).toBe(400);
    expect((await POST(req("not json"))).status).toBe(400);
    expect((await POST(req("x".repeat(11 * 1024)))).status).toBe(413);
  });

  it("rate limits per IP", async () => {
    rateLimit.mockResolvedValue({ success: false, remaining: 0, retryAfterMs: 1000 });
    const body = JSON.stringify({ "csp-report": { "blocked-uri": "x" } });
    expect((await POST(req(body))).status).toBe(429);
  });
});

describe("CSP headers in next.config", () => {
  const headerValue = async (config: typeof nextConfig, key: string) => {
    const [{ headers }] = await config.headers!();
    return headers.find((h) => h.key === key)?.value ?? "";
  };

  it("enforces a policy and sends no report-only trial by default", async () => {
    expect(await headerValue(nextConfig, "Content-Security-Policy")).toContain("'unsafe-inline'");
    expect(await headerValue(nextConfig, "Content-Security-Policy-Report-Only")).toBe("");
  });

  it("adds a stricter report-only policy when CSP_REPORT_ONLY=true", async () => {
    vi.stubEnv("CSP_REPORT_ONLY", "true");
    vi.resetModules();
    const { default: config } = await import("@/next.config");
    vi.unstubAllEnvs();
    const ro = await headerValue(config, "Content-Security-Policy-Report-Only");
    const scriptSrc = ro.split("; ").find((d) => d.startsWith("script-src")) ?? "";
    expect(scriptSrc).not.toContain("unsafe-inline");
    expect(scriptSrc).not.toContain("unsafe-eval");
    expect(scriptSrc).toContain("https://checkout.razorpay.com");
    expect(ro).toContain("report-uri /api/csp-report");
  });
});
