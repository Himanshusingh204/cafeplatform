// Rate limiting configuration — centralized so limits are easy to tune.
// Max values can be overridden per environment (e.g. larger budgets for
// automated suites) via LOGIN_RATE_MAX / CONTACT_RATE_MAX.
function positiveIntFromEnv(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const limits = {
  login: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: positiveIntFromEnv(process.env.LOGIN_RATE_MAX, 5), // attempts per window per IP + account
  },
  contact: {
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: positiveIntFromEnv(process.env.CONTACT_RATE_MAX, 3), // submissions per IP
  },
  adminMutation: {
    windowMs: 60 * 1000, // 1 minute
    max: 60, // mutations per session
  },
  publicRead: {
    windowMs: 60 * 1000, // 1 minute
    max: 300, // requests per IP
  },
} as const;

export const forms = {
  minMessageLength: 10,
  maxMessageLength: 2000,
  maxShortDescription: 200,
  maxDescription: 2000,
  maxNameLength: 120,
  maxEmailLength: 254,
  maxSubjectLength: 120,
  maxPhoneLength: 20,
} as const;

// Server-Sent Events.
//
// The hosting platform terminates a function at its `maxDuration`, which is
// currently 300 s on every plan (Hobby's maximum; Pro and Enterprise may raise
// it to 800). A route must declare that number itself — Next.js reads
// `maxDuration` by static analysis at build time, so it cannot come from here —
// which is why this block documents the budget rather than centralising it.
// Keep the literals in the two stream routes in sync with these numbers.
export const sse = {
  /** Must match `export const maxDuration` in the streaming route files. */
  maxDurationSeconds: 300,
  /**
   * How long the notification stream stays open before closing itself. Kept
   * comfortably below `maxDurationSeconds` so the client receives a graceful
   * end-of-stream instead of being cut off by the platform, and reconnects as a
   * deliberate event rather than a timeout.
   */
  notificationStreamLifetimeMs: 4 * 60 * 1000,
} as const;