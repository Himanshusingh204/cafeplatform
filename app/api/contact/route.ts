import { contactMessageSchema } from "@/lib/validation/schemas";
import { detectSpamScore, isSpam } from "@/lib/validation/contact";
import { rateLimit } from "@/lib/rate-limit/limiter";
import { limits } from "@/config/limits";
import { createContactMessage } from "@/lib/services/messages";
import { sendContactNotification } from "@/lib/email/notifier";
import { checkOrigin, getClientIp, getIpHash } from "@/lib/api/request";
import { ok, rateLimited, serverError, forbidden, validationError } from "@/lib/api/response";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const MIN_FORM_TIME_MS = 3 * 1000;

// Per-IP daily limit (separate from the short window limiter)
const IP_DAILY_MAX = 10;
const IP_DAILY_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function POST(request: Request) {
  if (!(await checkOrigin(request))) return forbidden();

  const ip = await getClientIp();
  const ipKey = ip ?? "unknown";

  // 1. Short window rate limit (10 min)
  const limiter = await rateLimit(`contact:${ipKey}`, limits.contact.max, limits.contact.windowMs);
  if (!limiter.success) return rateLimited(limiter.retryAfterMs);

  // 2. Per-IP daily limit (10 per day)
  const dailyLimiter = await rateLimit(`contact-daily:${ipKey}`, IP_DAILY_MAX, IP_DAILY_WINDOW_MS);
  if (!dailyLimiter.success) {
    logger.warn({ event: "contact.daily_limit", ipHash: ipKey });
    return rateLimited(dailyLimiter.retryAfterMs);
  }

  const body = await request.json().catch(() => ({}));
  const parsed = contactMessageSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Please check your input.";
    return validationError(firstError);
  }

  const { name, email, phone, subject, message, website, formStart } = parsed.data;

  // 3. Honeypot: any value means an automated bot
  if (website.length > 0) {
    return ok({ received: true });
  }

  // 4. Minimum interaction time guard (bots submit instantly)
  if (typeof formStart === "number" && formStart > 0) {
    const elapsed = Date.now() - formStart;
    if (elapsed < MIN_FORM_TIME_MS) {
      return ok({ received: true });
    }
  }

  // 5. Per-email rate limit (1 per 10 minutes per email address)
  const emailLimiter = await rateLimit(`contact-email:${email}`, 1, 10 * 60 * 1000);
  if (!emailLimiter.success) {
    logger.warn({ event: "contact.email_limit", email });
    return rateLimited(emailLimiter.retryAfterMs);
  }

  // 6. Spam content detection
  const spamScore = detectSpamScore(`${name} ${subject} ${message}`);
  if (isSpam(spamScore)) {
    logger.warn({ event: "contact.spam_detected", email, score: spamScore });
    return ok({ received: true }); // Silently drop, don't reveal detection
  }

  const ipHash = await getIpHash();

  try {
    await createContactMessage({ name, email, phone, subject, message, ipHash });
  } catch (error) {
    logger.error({ event: "contact.submit", result: "failed", error: String(error) });
    return serverError();
  }

  logger.info({ event: "contact.submit", result: "success", email });

  // Best-effort owner notification — fire and forget, never blocks the response.
  void sendContactNotification({ name, email, phone, subject, message }).catch(() => undefined);

  return ok({ received: true });
}