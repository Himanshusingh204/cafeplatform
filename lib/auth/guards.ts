import "server-only";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { hasPermission, type Permission } from "@/config/roles";

export async function requireAdmin() {
  const admin = await getSession();
  if (!admin) redirect("/admin/login");
  return admin;
}

export async function requirePermission(permission: Permission) {
  const admin = await requireAdmin();
  if (!hasPermission(admin.role, permission)) {
    throw new Error("FORBIDDEN");
  }
  return admin;
}