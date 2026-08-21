import { describe, expect, it } from "vitest";

import {
  categoryInputSchema,
  contactMessageSchema,
  dishInputSchema,
  listQuerySchema,
  loginSchema,
} from "@/lib/validation/schemas";

describe("mass-assignment protection", () => {
  it("strips injected privilege fields from the dish payload", () => {
    const parsed = dishInputSchema.safeParse({
      name: "Test Dish",
      categoryId: "00000000-0000-0000-0000-000000000000",
      shortDescription: "Short.",
      description: "A perfectly normal description.",
      price: 249,
      // Injected fields an attacker may add to a forged request:
      id: "00000000-0000-0000-0000-000000000001",
      role: "SUPER_ADMIN",
      isAdmin: true,
      actorId: "00000000-0000-0000-0000-000000000002",
      deletedAt: null,
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      const data = parsed.data as Record<string, unknown>;
      expect(data).not.toHaveProperty("id");
      expect(data).not.toHaveProperty("role");
      expect(data).not.toHaveProperty("isAdmin");
      expect(data).not.toHaveProperty("actorId");
      expect(data).not.toHaveProperty("deletedAt");
    }
  });

  it("strips injected fields from category and contact payloads", () => {
    const category = categoryInputSchema.safeParse({
      name: "Test Category",
      isActive: true,
      role: "SUPER_ADMIN",
    });
    expect(category.success).toBe(true);
    expect((category.data as Record<string, unknown>)).not.toHaveProperty("role");

    const contact = contactMessageSchema.safeParse({
      name: "Test Sender",
      email: "sender@test.example",
      subject: "Hello",
      message: "A message body that is long enough.",
      isAdmin: true,
      status: "REPLIED",
    });
    expect(contact.success).toBe(true);
    const contactData = contact.data as Record<string, unknown>;
    expect(contactData).not.toHaveProperty("isAdmin");
    expect(contactData).not.toHaveProperty("status");
  });

  it("never allows the login schema to carry a role", () => {
    const parsed = loginSchema.safeParse({
      email: "admin@test.example",
      password: "Whatever123!",
      role: "SUPER_ADMIN",
    });
    expect(parsed.success).toBe(true);
    expect((parsed.data as Record<string, unknown>)).not.toHaveProperty("role");
  });

  it("whitelists sort fields in list queries instead of trusting them", () => {
    const malicious = listQuerySchema.safeParse({
      sort: "passwordHash; DROP TABLE \"Dish\";--",
      dir: "ASC OR 1=1",
    });
    expect(malicious.success).toBe(false);

    const defaults = listQuerySchema.safeParse({});
    expect(defaults.success).toBe(true);
    if (defaults.success) {
      expect(defaults.data.sort).toBe("sortOrder");
      expect(defaults.data.dir).toBe("asc");
    }
  });
});
