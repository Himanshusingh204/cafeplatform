# TESTING.md

## Layers

```
tests/
  unit/         # Pure functions: validation, slugify, permissions, formatting, rate-limit logic
  integration/  # DB operations, auth flow, contact submission, CRUD, rate limiting
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

## Integration Test Targets

- Create/update/delete dish (with transaction + audit log)
- Category CRUD with unique slug conflicts
- Contact submission: valid → saved; invalid → 422; duplicate/spam → handled
- Login: correct creds → session; wrong creds → generic error + rate limit
- Session expiry → 401

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

### Public
Home → menu → filter category → open dish → contact → submit → confirm.

### Admin
Login → dashboard → create category → create dish → publish → edit → delete (confirm) → logout.

## Test DB

Separate database (`indian_cafe_test`) — never run tests against dev/prod data.

## CI

GitHub Actions `ci.yml` runs: install → lint → typecheck → unit/integration/security tests → build.