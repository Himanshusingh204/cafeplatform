# Spice & Saffron — Premium Indian Café Website

A production-grade, full-stack website for a modern Indian café: a fast, editorial public site driven by a PostgreSQL menu database, and a private, permission-checked admin CMS for managing dishes, categories, gallery, messages and site settings.

**Stack:** Next.js (App Router) · TypeScript · Tailwind CSS v4 · Prisma 7 + PostgreSQL · Argon2id auth · Zod validation · Framer Motion

---

## Quick Start

### 1. Prerequisites

| Requirement | Notes |
| --- | --- |
| Node.js 20+ | |
| PostgreSQL 14+ | Running locally or remotely |

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/indian_cafe?schema=public"
AUTH_SECRET="<generate with: openssl rand -base64 32>"
APP_URL="http://localhost:3000"
```

> `AUTH_SECRET` signs session cookies. Never commit real values — `.env.local` is gitignored.

### 4. Create the database, apply migrations and seed demo data

```bash
createdb indian_cafe                # or create it via your Postgres client
npx prisma migrate deploy           # apply committed migrations
npm run db:seed                     # categories, dishes, gallery, settings
```

### 5. Create your admin account

```bash
ADMIN_EMAIL="you@example.com" ADMIN_PASSWORD="YourStrongPassword!" npm run create-admin
```

The password is hashed with Argon2id before storage; the plaintext is never persisted.

### 6. Run

```bash
npm run dev          # http://localhost:3000
```

- Public site: `http://localhost:3000`
- Admin panel: `http://localhost:3000/admin/login`

---

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no emit |
| `npm test` | Vitest unit tests |
| `npm run db:migrate` | Apply pending migrations (`prisma migrate deploy`) |
| `npm run db:seed` | Seed development demo data |
| `npm run db:studio` | Prisma Studio (DB browser) |
| `npm run create-admin` | Bootstrap an admin account from env vars |

Run all quality gates before shipping: `lint`, `typecheck`, `test`, `build`.

---

## Project Structure

```
app/
  (public)/            Public pages (home, about, menu, gallery, contact, faq, legal)
  admin/               Protected CMS (login, dashboard, dishes, categories, …)
  api/                 Route handlers (auth, contact, health)
components/
  ui/                  Design-system primitives (Button, Input, Modal, Toast, …)
  layout/              Site header/footer
  home/ menu/ about/   Feature components
  admin/               Admin-only components
config/                Site info, navigation, SEO, rate limits, roles
lib/
  auth/                Passwords, sessions, route guards
  services/            Business logic (menu, gallery, messages, settings, audit)
  validation/          Zod schemas (server-authoritative)
  rate-limit/          In-memory token bucket
  db/                  Prisma client singleton
prisma/                Schema, migrations, seed
docs/                  Architecture & AI-session documentation (BRAIN.md first)
public/images/         Image assets + labelled placeholders
scripts/               Ops scripts (create-admin)
tests/                 Vitest suites
```

Full architecture decisions live in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md); conventions in [`docs/BRAIN.md`](docs/BRAIN.md).

---

## Security Model

- **Auth:** server-side sessions in HttpOnly + Secure + SameSite cookies; Argon2id password hashing; generic login errors (no account enumeration); login rate limiting.
- **Authorization:** every admin page and mutation independently verifies session **and** role permission (`config/roles.ts`: SUPER_ADMIN › ADMIN › EDITOR).
- **Input:** every payload validated server-side with Zod; explicit field allow-listing prevents mass assignment.
- **Anti-abuse:** rate limiting on login/contact/mutations, contact honeypot + minimum-form-time, origin checks on mutations.
- **Data:** parameterized queries via Prisma only; soft delete for dishes/categories; audit log for every admin action.
- **Secrets:** server-only env vars; nothing sensitive is ever prefixed `NEXT_PUBLIC_`.

The full checklist lives in [`docs/SECURITY.md`](docs/SECURITY.md).

---

## Content & Images

All business info (name, phone, hours, socials) is centralized in the DB `Setting` table with defaults in `config/site.ts` — editable at `/admin/settings`.

Placeholder images live in `public/images/placeholders/`. Replace them with real photography at the same paths (or upload via the admin gallery) before launch:

```
hero-placeholder.jpg      → homepage hero
dish-placeholder.jpg      → menu items without photos
gallery-placeholder.jpg   → gallery grid
about-placeholder.jpg     → story section
chef-placeholder.jpg      → team/about page
```

---

## Deployment (Vercel)

1. Push to GitHub; import the repo in Vercel.
2. Set `DATABASE_URL`, `AUTH_SECRET`, `APP_URL` (+ optional email/storage keys) per environment.
3. Migrations run via `prisma migrate deploy`; use a managed Postgres (Vercel Postgres, Neon, Supabase) with backups enabled.
4. Use separate databases for development / preview / production.

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for the full runbook.

---

## Documentation

`docs/` is the project's permanent memory. Start at [`docs/BRAIN.md`](docs/BRAIN.md), then [`docs/MEMORY.md`](docs/MEMORY.md) and [`docs/MASTER_PLAN.md`](docs/MASTER_PLAN.md). Update `docs/CHANGELOG.md` with any meaningful change.
