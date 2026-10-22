/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from "vitest";
import { redact, REDACTED } from "@/lib/observability/redact";
import { getRequestId, runWithRequestContext } from "@/lib/observability/context";
import { incCounter, recordHttpRequest, renderPrometheus, resetMetrics } from "@/lib/observability/metrics";

describe("redact", () => {
  it("masks sensitive keys deeply and keeps others", () => {
    const out = redact({
      authorization: "Bearer x",
      cookie: "a=b",
      nested: { password: "p", token: "t", apiKey: "k", email: "a@b.c", phone: "123", keep: 1 },
      list: [{ Email: "x@y.z" }],
    }) as Record<string, any>;
    expect(out.authorization).toBe(REDACTED);
    expect(out.cookie).toBe(REDACTED);
    expect(out.nested).toEqual({
      password: REDACTED,
      token: REDACTED,
      apiKey: REDACTED,
      email: REDACTED,
      phone: REDACTED,
      keep: 1,
    });
    expect(out.list[0].Email).toBe(REDACTED);
  });

  it("survives cycles", () => {
    const a: Record<string, unknown> = {};
    a.self = a;
    expect(() => redact(a)).not.toThrow();
  });
});

describe("request context", () => {
  it("exposes requestId inside run only", () => {
    expect(getRequestId()).toBeUndefined();
    runWithRequestContext({ requestId: "r1" }, () => expect(getRequestId()).toBe("r1"));
  });
});

describe("metrics", () => {
  it("renders counters, histograms and gauges", () => {
    resetMetrics();
    recordHttpRequest("/api/x", 503, 120);
    incCounter("orders_created_total", "Orders created");
    const text = renderPrometheus([{ name: "outbox_pending", help: "h", value: 3 }]);
    expect(text).toContain('http_requests_total{route="/api/x",status_class="5xx"} 1');
    expect(text).toContain('http_request_duration_ms_bucket{route="/api/x",status_class="5xx",le="250"} 1');
    expect(text).toContain("orders_created_total 1");
    expect(text).toContain("outbox_pending 3");
  });
});
