import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));

import { db } from "@/lib/db/prisma";
import { createGalleryImage, listGalleryAdmin } from "@/lib/services/gallery";
import { createContactMessage, listMessagesAdmin, updateMessageStatus } from "@/lib/services/messages";
import { createReview, deleteReview, getApprovedReviews, listReviewsAdmin, moderateReview } from "@/lib/services/reviews";
import { getSettingsFresh, updateSettings } from "@/lib/services/settings";
import { createCategory } from "@/lib/services/menu";
import { validateCoupon } from "@/lib/services/orders";
import { uniqueSuffix } from "../helpers/db";

async function twoTenants() {
  const s = uniqueSuffix();
  const [a, b] = await Promise.all([
    db.tenant.create({ data: { slug: `iso-a-${s}`, name: "Iso A" } }),
    db.tenant.create({ data: { slug: `iso-b-${s}`, name: "Iso B" } }),
  ]);
  return { a: a.id, b: b.id };
}

const settingsInput = (name: string) => ({
  cafeName: name,
  tagline: "",
  phone: "",
  email: "x@example.com",
  address: "",
  mapsLink: "",
  openingHours: "",
  instagram: "",
  facebook: "",
  whatsapp: "",
  reservationLink: "",
});

describe("tenant isolation (P2-4)", () => {
  it("settings are per tenant, with the same keys coexisting (P2-5)", async () => {
    const { a, b } = await twoTenants();
    await updateSettings(a, settingsInput("Cafe A"));
    await updateSettings(b, settingsInput("Cafe B"));
    await updateSettings(a, settingsInput("Cafe A2"));

    expect((await getSettingsFresh(a)).cafeName).toBe("Cafe A2");
    expect((await getSettingsFresh(b)).cafeName).toBe("Cafe B");
  });

  it("gallery, messages and reviews never cross tenants", async () => {
    const { a, b } = await twoTenants();
    const base = { title: "t", altText: "a", imageUrl: "/x.jpg", category: "FOOD" as const, sortOrder: 0, isPublished: true };
    await createGalleryImage({ ...base, tenantId: a });
    expect(await listGalleryAdmin(a)).toHaveLength(1);
    expect(await listGalleryAdmin(b)).toHaveLength(0);

    const msg = await createContactMessage({ tenantId: a, name: "n", email: "e@example.com", subject: "s", message: "m" });
    expect((await listMessagesAdmin({ tenantId: b })).total).toBe(0);
    await expect(updateMessageStatus(msg.id, "READ", b)).rejects.toThrow("NOT_FOUND");
    await expect(updateMessageStatus(msg.id, "READ", a)).resolves.toBeTruthy();

    const review = await createReview(a, { customerName: "Reviewer", rating: 5, title: "T", comment: "A fine long comment." });
    await expect(moderateReview(review.id, b, { isApproved: true })).rejects.toThrow("NOT_FOUND");
    await expect(deleteReview(review.id, b)).rejects.toThrow("NOT_FOUND");
    await moderateReview(review.id, a, { isApproved: true });
    expect((await getApprovedReviews(undefined, a)).map((r) => r.id)).toContain(review.id);
    expect(await getApprovedReviews(undefined, b)).toHaveLength(0);
    expect((await listReviewsAdmin(b)).total).toBe(0);
  });
});

describe("per-tenant uniqueness (P2-5)", () => {
  it("allows the same category slug and coupon code in two tenants, rejects within one", async () => {
    const { a, b } = await twoTenants();
    const cat = { name: "Starters", isActive: true, sortOrder: 0 };
    const ca = await createCategory({ ...cat, tenantId: a });
    const cb = await createCategory({ ...cat, tenantId: b });
    expect(ca.slug).toBe("starters");
    expect(cb.slug).toBe("starters");
    // Same tenant: the service de-duplicates, the DB would reject a raw duplicate.
    expect((await createCategory({ ...cat, tenantId: a })).slug).not.toBe("starters");
    await expect(
      db.category.create({ data: { tenantId: a, name: "x", slug: "starters" } })
    ).rejects.toThrow();

    await db.coupon.create({ data: { tenantId: a, code: "SAVE", discountPercent: 10 } });
    await db.coupon.create({ data: { tenantId: b, code: "SAVE", discountPercent: 50 } });
    await expect(
      db.coupon.create({ data: { tenantId: a, code: "SAVE", discountPercent: 5 } })
    ).rejects.toThrow();

    const ra = await validateCoupon("SAVE", 100, a);
    const rb = await validateCoupon("SAVE", 100, b);
    expect(ra.valid && ra.discountPercent).toBe(10);
    expect(rb.valid && rb.discountPercent).toBe(50);
    expect((await validateCoupon("SAVE", 100, (await twoTenants()).a)).valid).toBe(false);
  });
});
