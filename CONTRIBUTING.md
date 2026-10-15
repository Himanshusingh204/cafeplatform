# Contributing

**Project:** Spice & Saffron — Indian Fine Dining & Café Platform
**Maintainer:** Himanshu ([@Himanshusingh204](https://github.com/Himanshusingh204))

---

## Read this first — licensing

This project is **not open source**. It is released under a **proprietary,
source-available license** ([`LICENSE`](./LICENSE)):

- **Personal, private, non-commercial use** — permitted.
- **Any commercial use** — prohibited without a separate written commercial
  license. Contact **himanshuyt21361@gmail.com**.
- **The "Spice & Saffron" brand assets** — reserved, not licensed to you.

By opening a pull request you agree that your contribution may be used and
relicensed by the maintainer as part of the project (see `LICENSE`, section 7).

---

## Is this repository open to contributions?

**No.** This is a personal, closed product repository. Issues and pull requests
from the public are not actively solicited, and the maintainer may close them
without review.

The guidance below applies if you are the maintainer, or if the maintainer has
explicitly invited you to contribute.

---

## Development setup

### Prerequisites

| Tool | Version |
| :--- | :--- |
| Node.js | `>= 20.19` (CI uses 22; see `.nvmrc`) |
| npm | `>= 10` |
| PostgreSQL | `>= 14` (local, Docker, or hosted) |

### Bootstrap

```bash
git clone <repository-url>
cd cafe
npm install                 # runs `prisma generate` via postinstall
cp .env.example .env.local  # then fill in the values
npx prisma migrate deploy
npm run db:seed
```

Generate a session secret:

```bash
openssl rand -base64 32
```

### Running

```bash
npm run dev        # Next.js frontend only        → http://localhost:3000
npm run dev:server # Standalone API only          → http://localhost:4000
npm run dev:all    # Both, concurrently
```

---

## Quality gates — required before every commit

Every change must pass all four gates locally. CI enforces the same set.

```bash
npm run typecheck   # tsc --noEmit         — 0 errors
npm run lint        # eslint              — 0 errors, 0 warnings
npm test            # vitest run          — all suites green
npm run build       # next build          — must succeed
```

For UI or flow changes, also run:

```bash
npm run test:e2e    # builds, then runs Playwright (desktop + mobile)
```

**Do not open a pull request with a failing gate.** If a gate is failing for a
reason unrelated to your change, say so explicitly in the pull request.

---

## Coding conventions

### General

- **TypeScript strict.** No `any` without an inline justification comment.
- **No floating promises.** Always `await` or explicitly `void` them.
- **Server code imports `server-only`** where it touches the database, secrets,
  or Node APIs.
- **Never** import a server module into a Client Component.
- Prefer small, pure, testable functions in `lib/` over logic inside components.

### Naming

| Kind | Convention | Example |
| :--- | :--- | :--- |
| Files (modules) | `kebab-case` | `cache-manager.ts` |
| React components | `kebab-case` file, `PascalCase` export | `dish-card.tsx` → `DishCard` |
| Hooks | `use-*.tsx`, `useX` export | `use-cart.tsx` → `useCart` |
| Types / interfaces | `PascalCase` | `RealtimeEventPayload` |
| Constants | `SCREAMING_SNAKE_CASE` | `MAX_FILE_SIZE_BYTES` |
| DB models | `PascalCase` singular | `OrderItem` |
| Env vars | `SCREAMING_SNAKE_CASE` | `AUTH_SECRET` |

### Architecture boundaries

Respect the layering. Import direction is **one way only**:

```
app/  components/        (presentation — may import down)
        ↓
lib/services/            (domain logic — pure, testable)
        ↓
lib/db/  lib/cache/  lib/queue/  lib/realtime/   (infrastructure)
```

- Presentation **must not** open a database connection or read secrets directly.
- Domain services **must not** import React or Next.js request/response types.
- Infrastructure **must not** import presentation code.
- Shared contracts live in `config/` and `lib/validation/`.

### Security requirements for any change

These are non-negotiable. A change violating one will be rejected.

- Never trust client-supplied **prices, discounts, or totals** — recompute on
  the server from the database.
- Never log secrets, tokens, full card data, or raw personal data.
- Compare secrets with `crypto.timingSafeEqual`, never `===`.
- Parameterise all SQL. Raw SQL requires a comment explaining why Prisma cannot
  express it.
- New secrets go in `.env.example` as **empty placeholders** only — never as
  real values, and never in `NEXT_PUBLIC_*`.
- New tenant-scoped queries must filter by tenant and **fail closed** when the
  tenant cannot be resolved.
- New mutating endpoints need: Zod validation, authorisation, rate limiting,
  and idempotency where the operation is retryable.

### Style

- ESLint is the source of truth — do not disable rules inline without a
  written reason in the same comment.
- No commented-out code, no `console.log` in shipped paths (use `lib/logger.ts`).
- Keep components focused; extract when a file passes ~250 lines.
- Comments should explain **why**, not restate **what** the code does.

---

## Testing requirements

A change is not complete without tests.

| Change type | Required test |
| :--- | :--- |
| New domain/service function | Unit test in `tests/unit/` |
| New API route or Server Action | Integration test in `tests/integration/` |
| New user-facing flow | Playwright spec in `tests/e2e/` |
| Auth, payments, or tenant logic | Unit **and** security test |
| Bug fix | Regression test that fails before, passes after |

Rules:

- Tests must be **deterministic** — no reliance on wall-clock time, random
  ordering, or shared mutable state. Suites share one database and run
  serially, so **do not truncate tables in parallel**.
- Test the **behaviour and the contract**, not the implementation.
- Never weaken or delete an assertion to make a suite pass.

---

## Commit and pull-request conventions

Commits follow **Conventional Commits**:

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

Allowed types: `feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `build`,
`ci`, `chore`, `security`, `revert`.

Examples:

```
feat(orders): add tip splitting across payment gateways
fix(auth): reject sessions whose hash fails constant-time comparison
perf(db): add composite index for the tenant menu query
docs(license): clarify commercial licensing contact
security(s2s): bind API keys to an IP allowlist
```

Pull requests must include:

1. **What** changed and **why**.
2. **How** it was verified (commands run, and their result).
3. Any **migrations**, **env changes**, or **breaking changes** called out
   explicitly.
4. A **rollback plan** for anything touching the schema or payments.

---

## Database changes

- Schema changes are **migration-based only**. Never edit a migration that has
  already been applied.
- Use **expand → migrate → contract** for zero-downtime changes:
  add nullable column → backfill → add constraint → drop old column later.
- Every new column that is queried must be covered by an index. Explain the
  query the index serves in the pull request.
- Never write a destructive migration without an explicit backup step.

---

## Reporting bugs and vulnerabilities

- **Functional bugs** — open an issue with reproduction steps and expected
  versus actual behaviour.
- **Security vulnerabilities** — do **not** open a public issue. Follow
  [`SECURITY.md`](./SECURITY.md).

---

© 2026 Himanshu. All Rights Reserved.
