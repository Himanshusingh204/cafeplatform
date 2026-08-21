import type { AdminRole } from "@/lib/generated/prisma/enums";

export const permissions = {
  VIEW_MENU: "VIEW_MENU",
  CREATE_MENU: "CREATE_MENU",
  EDIT_MENU: "EDIT_MENU",
  DELETE_MENU: "DELETE_MENU",
  MANAGE_GALLERY: "MANAGE_GALLERY",
  VIEW_MESSAGES: "VIEW_MESSAGES",
  MANAGE_SETTINGS: "MANAGE_SETTINGS",
  VIEW_ACTIVITY: "VIEW_ACTIVITY",
  MANAGE_USERS: "MANAGE_USERS",
} as const;

export type Permission = (typeof permissions)[keyof typeof permissions];

const rolePermissions: Record<AdminRole, readonly Permission[]> = {
  SUPER_ADMIN: Object.values(permissions),
  ADMIN: [
    permissions.VIEW_MENU,
    permissions.CREATE_MENU,
    permissions.EDIT_MENU,
    permissions.DELETE_MENU,
    permissions.MANAGE_GALLERY,
    permissions.VIEW_MESSAGES,
    permissions.MANAGE_SETTINGS,
    permissions.VIEW_ACTIVITY,
  ],
  EDITOR: [
    permissions.VIEW_MENU,
    permissions.CREATE_MENU,
    permissions.EDIT_MENU,
    permissions.MANAGE_GALLERY,
    permissions.VIEW_MESSAGES,
  ],
};

export function hasPermission(role: AdminRole, permission: Permission): boolean {
  return rolePermissions[role].includes(permission);
}