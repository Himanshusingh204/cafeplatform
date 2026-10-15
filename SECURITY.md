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
