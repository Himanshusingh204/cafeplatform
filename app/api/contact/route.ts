import { contactMessageSchema } from "@/lib/validation/schemas";
import { rateLimit } from "@/lib/rate-limit/limiter";
import { limits } from "@/config/limits";
import { createContactMessage } from "@/lib/services/messages";
import { checkOrigin, getClientIp, getIpHash } from "@/lib/api/request";
import { ok, rateLimited, serverError, validationError } from "@/lib/api/response";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const MIN_FORM_TIME_MS = 3 * 1000;

export async function POST(request: Request) {
  if (!(await checkOrigin(request))) return validationError();

  const ip = await getClientIp();
  const ipKey = ip ?? "unknown";

  const limiter = rateLimit(`contact:${ipKey}`, limits.contact.max, limits.contact.windowMs);
  if (!limiter.success) return rateLimited(limiter.retryAfterMs);

  const body = await request.json().catch(() => ({}));
  const parsed = contactMessageSchema.safeParse(body);
  if (!parsed.success) return validationError();

  const { name, email, phone, subject, message, website, formStart } = parsed.data;

  // Honeypot: any value means an automated bot.
  if (website.length > 0) {
    return ok({ received: true });
  }

  // Minimum interaction time guard (bots submit instantly).
  if (typeof formStart === "number" && formStart > 0) {
    const elapsed = Date.now() - formStart;
    if (elapsed < MIN_FORM_TIME_MS) {
      return ok({ received: true });
    }
  }

  const ipHash = await getIpHash();

  try {
    await createContactMessage({ name, email, phone, subject, message, ipHash });
  } catch (error) {
    logger.error({ event: "contact.submit", result: "failed", error: String(error) });
    return serverError();
  }

  logger.info({ event: "contact.submit", result: "success" });

  return ok({ received: true });
}