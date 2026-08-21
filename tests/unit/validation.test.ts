import { describe, expect, it } from "vitest";

import {
  contactMessageSchema,
  dishInputSchema,
  loginSchema,
} from "@/lib/validation/schemas";

describe("loginSchema", () => {
  it("accepts valid credentials shape", () => {
    const result = loginSchema.safeParse({ email: "Admin@Example.com", password: "secret" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("admin@example.com");
  });

  it("rejects empty password", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
  });
});

describe("contactMessageSchema", () => {
  const base = {
    name: "Asha",
    email: "asha@example.com",
    subject: "Booking",
    message: "A table for six on Friday evening, please.",
  };

  it("accepts a normal submission and defaults honeypot fields", () => {
    const result = contactMessageSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.website).toBe("");
      expect(result.data.formStart).toBe(0);
    }
  });

  it("rejects a filled honeypot", () => {
    expect(contactMessageSchema.safeParse({ ...base, website: "http://spam.example" }).success).toBe(false);
  });

  it("rejects short messages", () => {
    expect(contactMessageSchema.safeParse({ ...base, message: "hi" }).success).toBe(false);
  });

  it("rejects oversized phone numbers", () => {
    expect(
      contactMessageSchema.safeParse({ ...base, phone: "999999999999999999999999" }).success
    ).toBe(false);
  });
});

describe("dishInputSchema", () => {
  const base = {
    name: "Butter Chicken",
    categoryId: "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
    description: "Slow-cooked tomato gravy with charcoal-finished chicken.",
    price: "349",
    isFeatured: true,
    isAvailable: true,
    isVegetarian: false,
    isVegan: false,
    isSpicy: false,
    containsNuts: false,
    sortOrder: "0",
  };

  it("coerces numeric strings and strips unknown fields (mass-assignment guard)", () => {
    const result = dishInputSchema.safeParse({
      ...base,
      shortDescription: "House signature.",
      role: "SUPER_ADMIN",
      actorId: "spoofed",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.price).toBe(349);
      expect((result.data as Record<string, unknown>).role).toBeUndefined();
    }
  });

  it("rejects negative prices", () => {
    expect(dishInputSchema.safeParse({ ...base, price: "-5" }).success).toBe(false);
  });

  it("rejects invalid category ids", () => {
    expect(dishInputSchema.safeParse({ ...base, categoryId: "not-a-uuid" }).success).toBe(false);
  });
});
