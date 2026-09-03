import { describe, it, expect } from "vitest";
import { generateReferenceCode } from "@/lib/services/reservations";

describe("Reservations Service Unit Tests", () => {
  it("generates a unique reference code with 'RES-' prefix", () => {
    const code1 = generateReferenceCode();
    const code2 = generateReferenceCode();

    expect(code1).toMatch(/^RES-[A-Z0-9]{5}$/);
    expect(code2).toMatch(/^RES-[A-Z0-9]{5}$/);
    expect(code1).not.toBe(code2);
  });
});
