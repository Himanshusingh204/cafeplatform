export const TEST_DB_NAME = "indian_cafe_test";

export function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL must be set (via .env) before running tests.");
  return url;
}

export function toAdminDatabaseUrl(url: string): string {
  const parsed = new URL(url);
  parsed.pathname = "/postgres";
  return parsed.toString();
}

export function toTestDatabaseUrl(url: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${TEST_DB_NAME}`;
  return parsed.toString();
}
