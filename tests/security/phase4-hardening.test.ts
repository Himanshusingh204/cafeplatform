import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiKeyFindUnique, apiKeyUpdate, orderFindFirst } = vi.hoisted(() => ({
  apiKeyFindUnique: vi.fn(),
  apiKeyUpdate: vi.fn(),
  orderFindFirst: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  db: {
    apiKey: { findUnique: apiKeyFindUnique, update: apiKeyUpdate },
    order: { findFirst: orderFindFirst },
  },
}));
vi.mock("@/lib/services/loyalty", () => ({ getCustomerLoyaltyProfile: vi.fn() }));

import {
  LAST_USED_WRITE_INTERVAL_MS,
  digestsMatch,
  shouldRecordUse,
  verifyS2SRequest,
} from "@/lib/auth/s2s";
import { buildAllowedOrigins, buildCorsOptions } from "@/server/middleware/cors";
import { GET as loyaltyGet } from "@/app/api/v1/loyalty/profile/route";

const sha = (v: string) => crypto.createHash("sha256").update(v).digest("hex");

describe("P1-6 digestsMatch", () => {
  it("matches equal digests and rejects different, empty or unequal-length ones", () => {
    expect(digestsMatch(sha("a"), sha("a"))).toBe(true);
    expect(digestsMatch(sha("a"), sha("b"))).toBe(false);
    expect(digestsMatch("", "")).toBe(false);
    expect(digestsMatch("abcd", sha("a"))).toBe(false);
  });
});

describe("P1-5 lastUsedAt throttle", () => {
  it("writes once, then not again inside the interval", () => {
    const t = 1_000_000_000_000;
    expect(shouldRecordUse("k1", null, t)).toBe(true);
    expect(shouldRecordUse("k1", null, t + 1000)).toBe(false);
    expect(shouldRecordUse("k1", null, t + LAST_USED_WRITE_INTERVAL_MS + 1)).toBe(true);
  });

  it("skips when the stored value is recent", () => {
    const t = 2_000_000_000_000;
    expect(shouldRecordUse("k2", new Date(t - 5000), t)).toBe(false);
  });
});

describe("verifyS2SRequest does not write lastUsedAt on every call", () => {
  beforeEach(() => {
    apiKeyFindUnique.mockReset();
    apiKeyUpdate.mockReset().mockResolvedValue({});
  });

  it("updates at most once across rapid requests", async () => {
    const token = `sp_live_${"ab".repeat(24)}`;
    apiKeyFindUnique.mockResolvedValue({
      id: "key-rapid",
      name: "n",
      tenantId: "t",
      keyHash: sha(token),
      isActive: true,
      expiresAt: null,
      scopes: ["orders:read"],
      lastUsedAt: null,
      tenant: { id: "t", slug: "s", name: "N", subscriptionPlan: "x", isActive: true },
    });
    const req = () => new Request("http://x/api", { headers: { authorization: `Bearer ${token}` } });
    for (let i = 0; i < 5; i++) {
      expect((await verifyS2SRequest(req(), "orders:read")).success).toBe(true);
    }
    expect(apiKeyUpdate).toHaveBeenCalledTimes(1);
  });
});

describe("P1-1 CORS allow-list", () => {
  it("never allows a wildcard and honours env origins", () => {
    const allowed = buildAllowedOrigins({
      NODE_ENV: "production",
      APP_URL: "https://cafe.example.com/",
      ALLOWED_ORIGINS: "*, https://admin.example.com",
    } as NodeJS.ProcessEnv);
    expect([...allowed].sort()).toEqual(["https://admin.example.com", "https://cafe.example.com"]);
  });

  it("rejects unknown origins and allows listed or origin-less requests", () => {
    const allowed = new Set(["https://cafe.example.com"]);
    const rejected: string[] = [];
    const opts = buildCorsOptions(allowed, (o) => rejected.push(o));
    const run = (o?: string) =>
      new Promise<boolean | undefined>((res) =>
        (opts.origin as (o: string | undefined, cb: (e: Error | null, a?: boolean) => void) => void)(o, (_e, a) => res(a))
      );
    return Promise.all([run("https://cafe.example.com"), run("https://evil.test"), run(undefined)]).then(([a, b, c]) => {
      expect(a).toBe(true);
      expect(b).toBe(false);
      expect(c).toBe(true);
      expect(rejected).toEqual(["https://evil.test"]);
      expect(opts.credentials).toBe(true);
      expect(opts.allowedHeaders).toContain("Idempotency-Key");
    });
  });

  it("server/app.ts uses the shared builder, not an open callback", () => {
    const src = readFileSync(resolve(process.cwd(), "server/app.ts"), "utf8");
    expect(src).toContain("buildCorsOptions");
    expect(src).not.toMatch(/origin:\s*\(origin[^)]*\)\s*=>\s*\{\s*callback\(null, true\)/);
  });
});

describe("P1-10 loyalty profile", () => {
  beforeEach(() => orderFindFirst.mockReset());

  it("rejects malformed email without touching the database", async () => {
    const res = await loyaltyGet(
      new Request("http://x/api/v1/loyalty/profile?email=not-an-email&orderNumber=A1", {
        headers: { "x-forwarded-for": "9.9.9.1" },
      })
    );
    expect(res.status).toBe(400);
    expect(orderFindFirst).not.toHaveBeenCalled();
  });

  it("rate limits repeated lookups from one client", async () => {
    let last = 0;
    for (let i = 0; i < 12; i++) {
      const res = await loyaltyGet(
        new Request("http://x/api/v1/loyalty/profile?email=a@b.co&orderNumber=ZZ", {
          headers: { "x-forwarded-for": "9.9.9.2" },
        })
      );
      last = res.status;
    }
    expect(last).toBe(429);
  });

  it("never calls a customer-creating function", () => {
    const src = readFileSync(resolve(process.cwd(), "app/api/v1/loyalty/profile/route.ts"), "utf8");
    expect(src).not.toContain("findOrCreateCustomer");
  });
});

describe("route guards (source-level)", () => {
  const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

  it("login throttles by IP before parsing the body", () => {
    const src = read("app/api/auth/login/route.ts");
    expect(src.indexOf("rateLimit(`login:")).toBeLessThan(src.indexOf("loginSchema.safeParse"));
    expect(src).toContain("checkOrigin");
  });

  it("cookie-authenticated mutations check the Origin", () => {
    for (const p of ["app/api/auth/login/route.ts", "app/api/auth/logout/route.ts", "app/api/upload/route.ts", "app/api/contact/route.ts"]) {
      expect(read(p), p).toContain("checkOrigin");
    }
  });

  it("id route params are validated with zod", () => {
    expect(read("app/api/v1/orders/[id]/route.ts")).toContain("routeIdSchema");
    expect(read("app/api/v1/waitlist/[id]/route.ts")).toContain("z.string().uuid()");
  });
});

describe("security headers in next.config.ts", () => {
  const src = readFileSync(resolve(process.cwd(), "next.config.ts"), "utf8");
  it.each([
    "Strict-Transport-Security",
    "X-Content-Type-Options",
    "Referrer-Policy",
    "Permissions-Policy",
    "frame-ancestors 'none'",
    "X-Frame-Options",
  ])("sets %s", (needle) => {
    expect(src).toContain(needle);
  });
});
