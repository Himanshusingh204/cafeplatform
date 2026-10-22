import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/outbox/process", () => ({
  processOutbox: vi.fn(async () => ({ claimed: 0, done: 0, retried: 0, dead: 0 })),
}));

import { GET } from "@/app/api/cron/outbox/route";
import { processOutbox } from "@/lib/outbox/process";

const req = (auth?: string) =>
  new Request("http://localhost/api/cron/outbox", { headers: auth ? { authorization: auth } : {} });

afterEach(() => {
  vi.unstubAllEnvs();
  vi.mocked(processOutbox).mockClear();
});

describe("GET /api/cron/outbox", () => {
  it("returns 503 in production when CRON_SECRET is unset", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CRON_SECRET", "");
    expect((await GET(req("Bearer x"))).status).toBe(503);
    expect(processOutbox).not.toHaveBeenCalled();
  });

  it("returns 401 for missing or wrong bearer", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    expect((await GET(req())).status).toBe(401);
    expect((await GET(req("Bearer nope"))).status).toBe(401);
    expect((await GET(req("Bearer s3cret-longer"))).status).toBe(401);
    expect(processOutbox).not.toHaveBeenCalled();
  });

  it("drains on a correct bearer", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    const res = await GET(req("Bearer s3cret"));
    expect(res.status).toBe(200);
    expect(processOutbox).toHaveBeenCalledOnce();
  });
});
