// Rate limiting configuration — centralized so limits are easy to tune.
export const limits = {
  login: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // attempts per window per IP + account
  },
  contact: {
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 3, // submissions per IP
  },
  adminMutation: {
    windowMs: 60 * 1000, // 1 minute
    max: 60, // mutations per session
  },
  publicRead: {
    windowMs: 60 * 1000, // 1 minute
    max: 300, // requests per IP
  },
  upload: {
    windowMs: 60 * 1000,
    max: 10,
  },
} as const;

export const upload = {
  maxBytes: 5 * 1024 * 1024, // 5 MB
  allowedMime: ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"],
  allowedExtensions: [".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif"],
} as const;

export const pagination = {
  pageSize: 50,
  maxPageSize: 100,
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