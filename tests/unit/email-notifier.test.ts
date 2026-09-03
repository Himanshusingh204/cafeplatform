import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  isContactNotificationConfigured,
  sendContactNotification,
} from "@/lib/email/notifier";

const sample = {
  name: "Asha Verma",
  email: "asha@example.com",
  phone: "+91 98100 11223",
  subject: "Private dinner",
  message: "<script>alert(1)</script> Table for eight on Saturday?",
};

describe("contact notification configuration", () => {
  const originalKey = process.env.EMAIL_API_KEY;
  const originalTo = process.env.CONTACT_NOTIFY_EMAIL;

  afterEach(() => {
    if (originalKey === undefined) delete process.env.EMAIL_API_KEY;
    else process.env.EMAIL_API_KEY = originalKey;
    if (originalTo === undefined) delete process.env.CONTACT_NOTIFY_EMAIL;
    else process.env.CONTACT_NOTIFY_EMAIL = originalTo;
    vi.unstubAllGlobals();
  });

  it("is disabled until both key and recipient exist", () => {
    delete process.env.EMAIL_API_KEY;
    process.env.CONTACT_NOTIFY_EMAIL = "owner@cafe.test";
    expect(isContactNotificationConfigured()).toBe(false);

    process.env.EMAIL_API_KEY = "re_test_key";
    expect(isContactNotificationConfigured()).toBe(true);
  });
});

describe("sendContactNotification", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    process.env.EMAIL_API_KEY = "re_test_key";
    process.env.CONTACT_NOTIFY_EMAIL = "owner@cafe.test";
    delete process.env.EMAIL_FROM_ADDRESS;
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    delete process.env.EMAIL_API_KEY;
    delete process.env.CONTACT_NOTIFY_EMAIL;
    vi.unstubAllGlobals();
  });

  it("posts an escaped, reply-addressable email to the Resend API", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));

    const result = await sendContactNotification(sample);

    expect(result.sent).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers.Authorization).toBe("Bearer re_test_key");

    const body = JSON.parse(init.body);
    expect(body.to).toBe("owner@cafe.test");
    expect(body.reply_to).toBe(sample.email);
    expect(body.subject).toBe(`[Contact] ${sample.subject}`);
    expect(body.html).not.toContain("<script>");
    expect(body.html).toContain("&lt;script&gt;");
    expect(body.text).toContain(sample.name);
    expect(body.text).toContain(sample.email);
  });

  it("reports failure without throwing when the API rejects", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 422 }));

    const result = await sendContactNotification(sample);

    expect(result.sent).toBe(false);
  });

  it("reports failure without throwing on network errors", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));

    const result = await sendContactNotification(sample);

    expect(result.sent).toBe(false);
  });

  it("skips sending entirely when unconfigured", async () => {
    delete process.env.EMAIL_API_KEY;

    const result = await sendContactNotification(sample);

    expect(result.sent).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
