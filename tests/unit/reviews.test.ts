import { describe, it, expect } from "vitest";

describe("Reviews Service Unit Tests", () => {
  it("clamps ratings between 1 and 5", () => {
    function clampRating(val: number) {
      return Math.max(1, Math.min(5, Math.round(val)));
    }

    expect(clampRating(6)).toBe(5);
    expect(clampRating(0)).toBe(1);
    expect(clampRating(4.6)).toBe(5);
    expect(clampRating(3.2)).toBe(3);
  });
});
