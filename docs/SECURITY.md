# SECURITY.md — Security Architecture

## Authentication

- Admin passwords hashed with **Argon2id** (unique salt per password). Database stores only the hash.
- Password hashes never leave the server, never logged, never emailed.
- Sessions: random 32-byte token → stored as sha256 hash in DB → HttpOnly + Secure + SameSite=Lax cookie → expiresAt (24h, sliding) → server-side verification on every protected request.
- Logout deletes the session server-side.

## Login Hardening

- Generic errors only: "Invalid credentials." (no account enumeration)
- Rate limit per IP + account: 5 / 15 min; temporary lockout after repeated failures.
- No password hints, no sensitive info in URLs.

## Authorization

- Role matrix: SUPER_ADMIN > ADMIN > EDITOR, checked via `hasPermission(role, permission)`.
- Every protected route (layout) and every mutation independently verifies session + permission.
- IDOR: ownership/resource checks before every read/update/delete. Never trust URL ids alone.

## Rate Limiting

- `lib/rate-limit` token-bucket limiter with Upstash Redis support (async) and in-memory fallback.
- Applied to login, contact, admin mutations, public reads.
- Limits configurable in `config/limits.ts`.

## Input Validation

- Zod schemas on every server boundary. Unknown fields stripped (mass-assignment protection).
- Lengths, formats, ranges, types all enforced. Client validation is UX only.

## Injection & XSS

- Prisma parameterized queries (no raw SQL anywhere).
- No unsanitized HTML rendering. Descriptions render as plain text with line breaks.
- Content-Security-Policy header set. No `dangerouslySetInnerHTML`.
- No `eval`, no `Function()`, no dynamic require.

## Upload Security

- Accept only `image/*`. Validate extension + MIME + magic bytes.
- Max size (e.g. 5 MB). Generate safe random filenames. Never trust original name.
- Store in non-executable path. Reject `.php/.js/.html/.exe/.sh` etc.
- Metadata stripped; images served via framework Image component.

## Secrets & Env

- Env vars: `DATABASE_URL`, `AUTH_SECRET`, `EMAIL_API_KEY`, `STORAGE_*`, `APP_URL`.
- Never `NEXT_PUBLIC_` for secrets. `.env.local` gitignored. `.env.example` committed.
- GitHub secret scanning + Dependabot enabled.

## Security Headers

`next.config` sets: CSP, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
`Permissions-Policy`, `Strict-Transport-Security` (prod), `X-Frame-Options: DENY`.

## CSRF

- HMAC-signed CSRF tokens (`lib/security/csrf.ts`) with HttpOnly cookies.
- SameSite=Lax cookies + origin/host checks on mutating requests + framework protections.

## Logging & Monitoring

- Structured server logs (see `lib/logger`). Request IDs for tracing.
- Never log passwords, tokens, API keys, or hashes.
- Error sanitization: client receives generic messages; details go to logs.

## Incident Response

1. Contain (revoke sessions, rotate secrets, disable accounts).
2. Assess via activity logs + request IDs.
3. Remediate (fix code, migrate data).
4. Document in CHANGELOG.

## Backups & Dependencies

- Automated DB backups + retention + tested restore procedure (documented in DEPLOYMENT.md).
- `npm audit` in CI, Dependabot alerts, review before upgrading.

## Security Test Matrix

- Anonymous admin access → blocked
- Session tampering/expiry → rejected
- IDOR id swap → denied
- Malicious upload → rejected
- 1000 rapid contact requests → rate-limited
- Login brute force → throttled
- XSS payload → rendered inert
- SQLi payload → parameterized/no effect
- Secrets in browser → none
- DB errors leaked → no (sanitized)
- Mass assignment → stripped
- Role escalation → denied
- Expired session reuse → denied
- `.env` access → 404/no exposure