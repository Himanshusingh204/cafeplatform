export const AVAILABLE_SCOPES = [
  "orders:read",
  "orders:write",
  "menu:read",
  "reservations:read",
  "reservations:write",
  "kds:stream",
  "admin:all",
] as const;

export type ApiScope = (typeof AVAILABLE_SCOPES)[number];
