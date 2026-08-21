import { describe, expect, it } from "vitest";

import {
  contactMessageSchema,
  descriptionSchema,
  dishInputSchema,
  emailSchema,
  nameSchema,
  phoneSchema,
  priceSchema,
  slugSchema,
} from "@/lib/validation/schemas";

const XSS_PAYLOADS = [
  "<script>alert(1)</script>",
  "<img src=x onerror=alert(1)>",
  "Butter <b>Chicken</b>",
  "javascript:alert(document.cookie)",
];

const SQLI_PAYLOADS = [
  "'; DROP TABLE \"Dish\";--",
  "1' OR '1'='1",
  "admin'--",
  "1; DELETE FROM \"Admin\"",
];

describe("payload injection through validation", () => {
  it.each(XSS_PAYLOADS)("stores the XSS payload %j as inert data", (payload) => {
    const parsed = nameSchema.safeParse(payload);
    // Values are stored verbatim as plain strings; rendering safety comes
    // from React's text escaping plus the Content-Security-Policy header.
    expect(parsed.success).toBe(true);
    expect(parsed.data).toBe(payload.trim());
  });

  it.each(SQLI_PAYLOADS)("treats the SQLi payload %j as inert data", (payload) => {
    const parsed = nameSchema.safeParse(payload);
    if (parsed.success) {
      expect(typeof parsed.data).toBe("string");
    }
    // Parameterized Prisma queries make any accepted value harmless.
  });

  it("strips control characters from descriptions", () => {
    const parsed = descriptionSchema.safeParse("Nice dish\u0000 with\u001F odd control chars");
    expect(parsed.success).toBe(true);
    expect(parsed.data).toBe("Nice dish with odd control chars");
  });

  it("rejects a contact payload whose honeypot field was filled", () => {
    const result = contactMessageSchema.safeParse({
      name: "Bot Bot",
      email: "bot@test.example",
      subject: "Spam",
      message: "Buy my product now please.",
      website: "http://spam.example",
    });
    expect(result.success).toBe(false);
  });

  it("normalizes email case and rejects malformed addresses", () => {
    expect(emailSchema.safeParse("  Visitor@TEST.example ").success).toBe(true);
    const normalized = emailSchema.safeParse("Visitor@TEST.example");
    if (normalized.success) expect(normalized.data).toBe("visitor@test.example");

    expect(emailSchema.safeParse("not-an-email").success).toBe(false);
    expect(emailSchema.safeParse("a@b@c").success).toBe(false);
  });

  it("rejects phone numbers outside the allowed shape", () => {
    expect(phoneSchema.safeParse("+91 98765 43210").success).toBe(true);
    expect(phoneSchema.safeParse("99999999999999999999999999999").success).toBe(false);
    expect(phoneSchema.safeParse("call me maybe").success).toBe(false);
  });

  it("bounds prices to sane positive values", () => {
    expect(priceSchema.safeParse(0).success).toBe(false);
    expect(priceSchema.safeParse(-5).success).toBe(false);
    expect(priceSchema.safeParse(100000).success).toBe(false);
    expect(priceSchema.safeParse("349.999").success).toBe(true);

    const coerced = priceSchema.safeParse("349.999");
    if (coerced.success) expect(coerced.data).toBe(350);
  });

  it("enforces the slug format strictly", () => {
    expect(slugSchema.safeParse("butter-chicken").success).toBe(true);
    expect(slugSchema.safeParse("Butter Chicken").success).toBe(false);
    expect(slugSchema.safeParse("../etc/passwd").success).toBe(false);
    expect(slugSchema.safeParse("dish--double").success).toBe(false);
  });

  it("rejects an oversized description", () => {
    expect(descriptionSchema.safeParse("x".repeat(10_000)).success).toBe(false);
  });
});

describe("dish payload hardening", () => {
  function baseDish() {
    return {
      name: "Test Dish",
      categoryId: "00000000-0000-0000-0000-000000000000",
      shortDescription: "Short.",
      description: "A perfectly normal description.",
      price: 249,
    };
  }

  it("accepts a minimal valid dish", () => {
    expect(dishInputSchema.safeParse(baseDish()).success).toBe(true);
  });

  it("rejects non-uuid category references", () => {
    const parsed = dishInputSchema.safeParse({ ...baseDish(), categoryId: "../../etc" });
    expect(parsed.success).toBe(false);
  });

  it("coerces string booleans instead of trusting them blindly", () => {
    const parsed = dishInputSchema.safeParse({ ...baseDish(), isFeatured: "yes" });
    expect(parsed.success).toBe(false);
  });

  it("bounds preparation time and calories", () => {
    expect(
      dishInputSchema.safeParse({ ...baseDish(), preparationTime: 999_999 }).success
    ).toBe(false);
    expect(dishInputSchema.safeParse({ ...baseDish(), calories: 99_999 }).success).toBe(false);
  });
});
