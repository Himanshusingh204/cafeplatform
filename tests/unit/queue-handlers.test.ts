import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { emailDispatchHandler, type EmailJobPayload } from "@/lib/queue/handlers";
import type { Job } from "@/lib/queue/job-queue";

const payload: EmailJobPayload = {
  to: "guest@example.com",
  subject: "Order Confirmation #ORD-260101-AAA111",
  body: "Thank you for your order!",
  orderNumber: "ORD-260101-AAA111",
};

function makeJob(): Job<EmailJobPayload> {
  return {
    id: "job_test",
    type: "EMAIL_DISPATCH",
    payload,
    attempts: 1,
    maxRetries: 3,
    createdAt: new Date().toISOString(),
    scheduledFor: Date.now(),
    status: "PROCESSING",
  };
}

describe("emailDispatchHandler", () => {
  const fetchMock = vi.fn();
  const originalKey = process.env.EMAIL_API_KEY;

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.EMAIL_API_KEY;
    else process.env.EMAIL_API_KEY = originalKey;
    vi.unstubAllGlobals();
  });

  it("is a no-op when no email provider is configured", async () => {
    delete process.env.EMAIL_API_KEY;

    await expect(emailDispatchHandler(payload, makeJob())).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends through the provider when configured", async () => {
    process.env.EMAIL_API_KEY = "re_test_key";
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));

    await emailDispatchHandler(payload, makeJob());

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers.Authorization).toBe("Bearer re_test_key");

    const body = JSON.parse(init.body);
    expect(body.to).toBe(payload.to);
    expect(body.subject).toBe(payload.subject);
    expect(body.text).toBe(payload.body);
  });

  it("throws on provider failure so the queue can retry and dead-letter", async () => {
    process.env.EMAIL_API_KEY = "re_test_key";
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }));

    await expect(emailDispatchHandler(payload, makeJob())).rejects.toThrow(
      /Email dispatch failed/
    );
  });
});
