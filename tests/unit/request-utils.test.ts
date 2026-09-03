import { describe, expect, it } from "vitest";
import { hashIp } from "@/lib/utils/requestId";

describe("hashIp", () => {
  it("returns a 40-character hex hash for a valid IP", () => {
    const hash = hashIp("127.0.0.1");
    expect(hash).toHaveLength(40);
    expect(/^[0-9a-f]{40}$/.test(hash)).toBe(true);
  });

  it("returns consistent hashes for the same IP", () => {
    const hash1 = hashIp("192.168.1.1");
    const hash2 = hashIp("192.168.1.1");
    expect(hash1).toBe(hash2);
  });

  it("returns different hashes for different IPs", () => {
    const hash1 = hashIp("127.0.0.1");
    const hash2 = hashIp("192.168.1.1");
    expect(hash1).not.toBe(hash2);
  });

  it("handles IPv6 addresses", () => {
    const hash = hashIp("::1");
    expect(hash).toHaveLength(40);
    expect(/^[0-9a-f]{40}$/.test(hash)).toBe(true);
  });
});
