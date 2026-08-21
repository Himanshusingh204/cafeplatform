import { describe, expect, it } from "vitest";

import { hasPermission, permissions } from "@/config/roles";
import type { AdminRole } from "@/lib/generated/prisma/enums";

describe("hasPermission", () => {
  it("gives SUPER_ADMIN every permission", () => {
    expect(hasPermission("SUPER_ADMIN" as AdminRole, permissions.MANAGE_USERS)).toBe(true);
    expect(hasPermission("SUPER_ADMIN" as AdminRole, permissions.DELETE_MENU)).toBe(true);
  });

  it("lets ADMIN delete but not manage users", () => {
    expect(hasPermission("ADMIN" as AdminRole, permissions.DELETE_MENU)).toBe(true);
    expect(hasPermission("ADMIN" as AdminRole, permissions.MANAGE_USERS)).toBe(false);
  });

  it("denies EDITOR destructive and administrative powers", () => {
    expect(hasPermission("EDITOR" as AdminRole, permissions.DELETE_MENU)).toBe(false);
    expect(hasPermission("EDITOR" as AdminRole, permissions.MANAGE_SETTINGS)).toBe(false);
    expect(hasPermission("EDITOR" as AdminRole, permissions.CREATE_MENU)).toBe(true);
  });
});
