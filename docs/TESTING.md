# TESTING.md

## Layers

```
tests/
  unit/         # Pure functions: validation, slugify, permissions, formatting, rate-limit, CSRF, request utils
  integration/  # DB operations, auth flow, contact submission, CRUD, rate limiting, settings, gallery, audit
  security/     # Unauthorized access, IDOR, mass assignment, XSS/SQLi, upload abuse
  e2e/          # Public + admin user journeys (Playwright)
```

## Commands

- `npm test` — unit + integration + security (Vitest)
- `npm run test:e2e` — Playwright smoke journeys (requires running app)
- `npm run lint` — ESLint
- `npm run typecheck` — `tsc --noEmit`
- `npm run build` — production build

## Unit Test Targets

- Zod schemas (price, email, phone, name, message length, slug pattern)
- `slugify()` edge cases
- `hasPermission()` matrix
- `formatPrice()` (₹ formatting)
- Rate limiter window/limit behavior
- Request ID generation
- CSRF token generation and validation (HMAC)
- IP hashing (IPv4/IPv6)

## Integration Test Targets

- Create/update/delete dish (with transaction + audit log)
- Category CRUD with unique slug conflicts
- Contact submission: valid → saved; invalid → 422; duplicate/spam → handled
- Login: correct creds → session; wrong creds → generic error + rate limit
- Session expiry → 401
- Settings CRUD with audit logging and caching
- Gallery CRUD with NOT_FOUND guards and audit logging
- Audit log service (all action types, null fields)

## Security Test Targets

- Anonymous → `/admin/*` redirects/401
- Authenticated but without permission → 403
- IDOR: edit dish of another tenant (single-tenant: verify resource existence + permission)
- Mass assignment: POST extra fields (`role`, `id`) → stripped
- XSS payloads in dish name/description → rendered inert
- SQLi payloads → parameterized, no effect
- Oversized upload → rejected
- Invalid MIME + fake extension → rejected
- Rate limit exceeded → 429
- Path traversal in filename → neutralized

## E2E Journeys

Playwright runs two projects: **chromium** (desktop) and **mobile-chrome** (Pixel 7 viewport). Serial execution keeps flows deterministic (e.g. the inbox check reads the message submitted by the public suite).

### Public (6 specs, 15 tests)
- **homepage** — hero, nav, mobile menu toggle
- **menu** — category anchors, dish cards, dietary tags
- **gallery** — image rendering
- **faq** — details/summary expand
- **contact** — client validation blocks empty submit; filled submission → "Message received" toast
- **404** — branded "This page has left the kitchen" page with "Back to home" link

### Admin (4 specs, 23 tests)
- **Login** — wrong password → generic "Invalid credentials"; forged cookie → 404 render (no data leak)
- **Dashboard** — stats cards render; navigation works
- **Category CRUD** — create, verify row exists, delete with confirmation → category gone
- **Dish CRUD** — create row in table, delete with confirmation → row gone
- **Messages inbox** — visitor submission from public suite appears

### E2E Infrastructure
- `playwright.config.ts` — 2 projects: chromium + mobile-chrome (explicit 412×915 viewport)
- `tests/e2e/global-setup.ts` — migrates + deploys isolated `indian_cafe_test` DB via `execSync`
- `vitest.config.ts` — exclude: `["tests/e2e/**"]` so E2E specs don't run under vitest
- Env overrides: `LOGIN_RATE_MAX=100`, `CONTACT_RATE_MAX=50` (unblocks suite from in-memory rate limiter lockout)

## Test DB

Separate database (`indian_cafe_test`) — never run tests against dev/prod data.

## CI

GitHub Actions `ci.yml` runs: install → lint → typecheck → unit/integration/security tests → build → E2E (chromium).