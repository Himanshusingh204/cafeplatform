# Security Policy

**Project:** Spice & Saffron — Indian Fine Dining & Café Platform
**Maintainer:** Himanshu ([@Himanshusingh204](https://github.com/Himanshusingh204))
**Contact:** himanshuyt21361@gmail.com

---

## Supported Versions

This is a single-branch, actively developed product. Only the latest commit on
`main` is supported. There are no maintained back-branches.

| Version | Supported |
| :--- | :--- |
| `main` (latest) | ✅ Yes |
| Any older commit / fork | ❌ No |

---

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Report privately, in this order of preference:

1. **GitHub Private Vulnerability Reporting** — use the *Security* tab →
   *Report a vulnerability* on the repository. This is the preferred channel.
2. **Email** — `himanshuyt21361@gmail.com` with the subject line
   `[SECURITY] Spice & Saffron — <short summary>`.

### What to include

A good report lets me reproduce the issue quickly. Please include:

- **Summary** — one or two sentences on the vulnerability and its impact.
- **Severity** — your assessment (Critical / High / Medium / Low) and why.
- **Affected component** — file path, route, or subsystem
  (e.g. `app/api/v1/orders/route.ts`, `lib/auth/session.ts`, `/admin/settings`).
- **Reproduction steps** — exact requests, payloads, or a script. Include
  HTTP method, path, headers, and body.
- **Proof of concept** — a truncated request/response or screenshot. Never
  include real customer data, live API keys, or production credentials.
- **Impact assessment** — what an attacker gains: data disclosure, privilege
  escalation, tenant crossover, financial loss, denial of service.
- **Suggested remediation** — optional, but welcome.
- **Your contact and disclosure preference** — how you would like to be
  credited, if at all.

### What NOT to include

- Real production `DATABASE_URL`, `AUTH_SECRET`, gateway keys, or webhook secrets.
- Real customer personal data (names, emails, phone numbers, order history).
- Automated scanner output with no demonstrated impact.

---

## Response Timeline

These are good-faith targets, not contractual guarantees.

| Stage | Target |
| :--- | :--- |
| Acknowledgement of report | within **3 business days** |
| Initial triage and severity assessment | within **7 business days** |
| Fix for Critical / High severity | within **14 business days** |
| Fix for Medium / Low severity | next scheduled release |
| Public disclosure (coordinated) | within **90 days** of the fix |

I will keep you updated at each stage and will credit you in the release notes
if you wish.

---

## Scope

### In scope

- Authentication and session handling (`lib/auth/**`)
- Authorization and role enforcement (`config/roles.ts`, `lib/auth/guards.ts`)
- Tenant isolation and cross-tenant data access
- Server Actions and Route Handlers (`app/**/actions/**`, `app/api/**`)
- S2S API key verification and HMAC webhook verification (`lib/auth/s2s.ts`, `lib/payments/**`)
- Payment flows, price authority, and coupon validation (`lib/services/orders.ts`)
- Injection classes: SQL/NoSQL, command, template, header, prototype pollution
- SSRF, open redirect, path traversal, unrestricted file upload
- Stored/reflected XSS and Content-Security-Policy bypass
- CSRF and Origin/Host header trust issues
- Idempotency and replay-protection bypass
- Rate-limit bypass and credential stuffing
- Insecure direct object reference (IDOR) on orders, reservations, loyalty
- Sensitive data exposure in responses, logs, or telemetry

### Out of scope

- Denial of service via raw traffic volume, without an application-layer defect
- Findings that require a compromised local machine, browser extension, or
  a already-privileged admin account acting maliciously
- Missing security headers with no demonstrated exploit
- Reports produced solely by an automated scanner with no working proof of
  concept
- Social engineering, physical access, or third-party platform issues
  (hosting provider, payment gateway, DNS registrar)
- Vulnerabilities in dependencies that have no reachable code path in this
  application (report those upstream; `npm audit` runs weekly in CI)
- Self-XSS requiring the victim to paste attacker-controlled code into their
  own console

---

## Security Design Commitments

This repository is expected to maintain the following invariants. A regression
in any of them is treated as a security defect.

- **Passwords** are hashed with **Argon2id** and never logged or returned.
- **Session tokens** are 256-bit CSPRNG values; only their **SHA-256 hash** is
  stored. Cookies are `HttpOnly`, `SameSite=Lax`, and `Secure` in production.
- **Secrets** are supplied via environment variables only. `.env*` is
  git-ignored; `.env.example` holds empty placeholders exclusively.
- **All machine secrets are compared in constant time**
  (`crypto.timingSafeEqual`) — API keys and webhook signatures included.
- **Authoritative pricing is server-side.** Client-submitted prices, discounts
  and totals are never trusted.
- **All database access is parameterised** through Prisma. Raw SQL is permitted
  only when parameterised, and must be reviewed.
- **Tenant isolation is enforced on every tenant-scoped query**, and a missing
  tenant must fail closed (404/403) — never silently fall back to another tenant.
- **Webhook ingress is idempotent** and signature-verified before any state
  mutation.
- **Mutating endpoints are idempotent** and rate-limited.
- **Every privileged mutation is audit-logged** with actor, action, entity and
  metadata.

---

## Hardening Checklist for Deployments

Before going to production, verify:

- [ ] `AUTH_SECRET` is a fresh 32-byte random value, unique to this deployment.
- [ ] `DATABASE_URL` uses TLS (`sslmode=require`) and a least-privilege role.
- [ ] Production super-admin created via `npm run create-admin`; no demo credentials exist.
- [ ] All payment keys are live-mode and webhook secrets are set.
- [ ] `NODE_ENV=production` so `Secure` cookies and HSTS are enforced.
- [ ] CORS allowlist is restricted to real production origins.
- [ ] Rate limiting uses a shared store (Redis), not per-instance memory.
- [ ] Secret scanning and branch protection are enabled on `main`.

---

## Acknowledgements

Responsible disclosure is genuinely appreciated. With your permission, I will
credit you in the release notes for a confirmed, fixed vulnerability.

© 2026 Himanshu. All Rights Reserved.

---

## Threat Model Summary

**Assets:** customer PII (orders, reservations, loyalty), payment/webhook integrity, admin
sessions, tenant isolation, S2S API keys, uploaded media.

**Trust boundaries:** public browser to Next/Express; third-party webhooks (Razorpay, Stripe,
partner ingress) to the API; S2S clients to `/api/v1/*`; app to Postgres/Redis/object storage.

| Threat | Mitigation | Code |
| :--- | :--- | :--- |
| Misconfigured/insecure production boot | Fail-fast aggregated env validation (names only) | `lib/config/env.ts`, `instrumentation.ts`, `server/api.ts` |
| Per-instance state (duplicate orders, bypassed limits) | Redis required in production unless `ALLOW_IN_MEMORY_STATE=true`; critical routes refuse | `lib/api/request-guards.ts`, `lib/rate-limit/` |
| Replay / duplicate order submits | Idempotency key scoped by tenant+operation, bound to payload hash (409 on mismatch) | `lib/api/request-guards.ts`, `lib/resilience/idempotency.ts` |
| Forged webhooks | HMAC signature verification, fail closed when secret blank | `app/api/v1/webhooks/*`, `lib/payments/engine.ts` |
| Stolen/abused S2S keys | Hashed at rest, scoped, optional IP allowlist, rate limited | `lib/auth/s2s.ts` |
| Admin session theft | Opaque hashed tokens, httpOnly, secure, sameSite=lax cookie | `lib/auth/session.ts` |
| CSRF / cross-origin mutation | Origin check with explicit allowlist | `proxy.ts` |
| Connection exhaustion | Bounded pg pool, statement timeout | `lib/db/pool-config.ts`, `lib/db/prisma.ts` |
| Secret leakage in repo | gitleaks scan in CI | `.github/workflows/ci.yml` |

## Key Rotation

**S2S API keys:** create a new key for the tenant (admin developer portal) with the same scopes
and IP allowlist; deploy it to the client; confirm traffic on the new key; revoke the old key.
Keys are shown once and stored only as SHA-256 hashes, so rotation is always create-then-revoke.
Rotate immediately on suspected exposure.

**Webhook secrets** (`RAZORPAY_WEBHOOK_SECRET`, `STRIPE_WEBHOOK_SECRET`, `PARTNER_WEBHOOK_SECRET`):
set the new secret at the provider, update the environment variable, redeploy, then verify a
test event succeeds. For a zero-gap window, briefly accept both at the provider (dual secrets)
where supported; otherwise rotate during low traffic. Also rotate `CRON_SECRET` and `AUTH_SECRET`
the same way (rotating session tokens requires users to sign in again).

**Disclosure contact:** see "Reporting a Vulnerability" above (GitHub private reporting, or
himanshuyt21361@gmail.com).
