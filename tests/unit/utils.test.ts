import { describe, expect, it } from "vitest";

import { ensureUniqueSlug, slugify } from "@/lib/utils/slugify";
import { formatPrice } from "@/lib/utils/format";

describe("slugify", () => {
  it("lowercases and hyphenates names", () => {
    expect(slugify("Butter Chicken")).toBe("butter-chicken");
  });

  it("strips apostrophes and collapses separators", () => {
    expect(slugify("Paneer Tikka's Special")).toBe("paneer-tikkas-special");
    expect(slugify("Dal  Makhani -- Style")).toBe("dal-makhani-style");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("  Naan! ")).toBe("naan");
  });

  it("handles non-latin input by returning empty string", () => {
    expect(slugify("पनीर")).toBe("");
  });
});

describe("ensureUniqueSlug", () => {
  it("returns the base when free", () => {
    expect(ensureUniqueSlug("lassi", [])).toBe("lassi");
  });

  it("appends the next free counter", () => {
    expect(ensureUniqueSlug("lassi", ["lassi"])).toBe("lassi-2");
    expect(ensureUniqueSlug("lassi", ["lassi", "lassi-2", "lassi-3"])).toBe("lassi-4");
  });
});

describe("formatPrice", () => {
  it("formats whole rupees without decimals", () => {
    expect(formatPrice(349)).toMatch(/₹\u00A0?349/);
  });

  it("keeps paise when present", () => {
    expect(formatPrice(249.5)).toMatch(/249\.5/);
  });

  it("falls back to zero for invalid input", () => {
    expect(formatPrice(Number.NaN)).toMatch(/₹/);
  });
});
