import { db } from "@/lib/db/prisma";
import { createSession } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/passwords";
import { rateLimit } from "@/lib/rate-limit/limiter";
import { loginSchema } from "@/lib/validation/schemas";
import { limits } from "@/config/limits";
import { logAction } from "@/lib/services/audit";
import { checkOrigin, getClientIp, getIpHash } from "@/lib/api/request";
import { fail, ok, rateLimited, unauthorized, forbidden } from "@/lib/api/response";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await checkOrigin(request))) return forbidden();

  const ipKey = (await getClientIp()) ?? "unknown";

  const parsed = loginSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return fail("VALIDATION_ERROR", "Please check your email and password.", 422);

  const { email, password } = parsed.data;

  const limiter = await rateLimit(`login:${ipKey}`, limits.login.max, limits.login.windowMs);
  if (!limiter.success) return rateLimited(limiter.retryAfterMs);

  const accountLimiter = await rateLimit(`login-account:${email}`, limits.login.max, limits.login.windowMs);
  if (!accountLimiter.success) return rateLimited(accountLimiter.retryAfterMs);

  const admin = await db.admin.findUnique({ where: { email } });

  // Always run a hash comparison to keep timing consistent for existing vs missing accounts.
  const dummyHash = "$argon2id$v=19$m=19456,t=2,p=1$c2FsdHNhbHRzYWx0$8/hcX9GpyQkGm0Ju2Xv4vCX2dG6w3B1YdG7C9V3Qe4";
  const valid = admin && admin.isActive ? await verifyPassword(admin.passwordHash, password) : await verifyPassword(dummyHash, password);

  if (!admin || !valid || !admin.isActive) {
    await logAction({
      actorId: admin?.id ?? null,
      action: "LOGIN_FAILED",
      entityType: "ADMIN",
      entityId: admin?.id ?? null,
      metadata: { ipHash: await getIpHash() },
    }).catch(() => undefined);
    return unauthorized();
  }

  await createSession(admin.id);
  await db.admin.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });

  await logAction({
    actorId: admin.id,
    action: "LOGIN",
    entityType: "ADMIN",
    entityId: admin.id,
  });

  logger.info({ event: "admin.login", userId: admin.id, result: "success" });

  return ok({ id: admin.id, email: admin.email, name: admin.name, role: admin.role });
}