import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { checkOrigin } from "@/lib/api/request";

const ORIGINAL_ENV = { ...process.env };

function originRequest(origin?: string): Request {
  return new Request("http://localhost:3000/api/admin/login", {
    method: "POST",
    headers: origin === undefined ? {} : { origin },
  });
}

describe("checkOrigin (CSRF origin allowlist)", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.stubEnv("APP_URL", "https://cafe.example.com");
    vi.stubEnv("ALLOWED_ORIGINS", "");
    vi.stubEnv("NODE_ENV", "production");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    process.env = { ...ORIGINAL_ENV };
  });

  it("accepts the canonical APP_URL origin", async () => {
    await expect(checkOrigin(originRequest("https://cafe.example.com"))).resolves.toBe(true);
  });

  it("rejects attacker-controlled vercel.app deployments", async () => {
    await expect(checkOrigin(originRequest("https://evil-attacker.vercel.app"))).resolves.toBe(false);
  });

  it("rejects a lookalike suffix that merely ends with the trusted host", async () => {
    await expect(checkOrigin(originRequest("https://cafe.example.com.evil.test"))).resolves.toBe(false);
  });

  it("accepts an explicitly allowlisted origin", async () => {
    vi.stubEnv("ALLOWED_ORIGINS", "https://staging.example.com, https://www.example.com");
    await expect(checkOrigin(originRequest("https://staging.example.com"))).resolves.toBe(true);
    await expect(checkOrigin(originRequest("https://www.example.com"))).resolves.toBe(true);
  });

  it("rejects localhost in production but allows it in development", async () => {
    await expect(checkOrigin(originRequest("http://localhost:3000"))).resolves.toBe(false);

    vi.stubEnv("NODE_ENV", "development");
    await expect(checkOrigin(originRequest("http://localhost:3000"))).resolves.toBe(true);
  });

  it("allows requests without an Origin header (server-to-server / curl)", async () => {
    await expect(checkOrigin(originRequest())).resolves.toBe(true);
  });

  it("rejects malformed Origin values", async () => {
    await expect(checkOrigin(originRequest("not a url"))).resolves.toBe(false);
  });
});
