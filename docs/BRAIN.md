# BRAIN.md — Indian Café Website

This is the most important AI memory file. Read this file **before any modification** along with `docs/MEMORY.md`, `docs/PROJECT_OVERVIEW.md`, and `docs/ARCHITECTURE.md`.

---

## Project Identity

**Name:** Spice & Saffron — Indian Café (working name, replaceable in `config/site.ts`)
**Type:** Premium, minimalist Indian café website + private admin CMS
**Client:** Café owner (single-tenant)
**Deployment target:** Vercel + PostgreSQL + GitHub

## Project Purpose

Deliver a production-grade café website that:

- Presents the café beautifully to visitors (menu, gallery, contact, about).
- Lets the owner manage the full menu, gallery, messages, and site settings privately.
- Is secure, validated, rate-limited, tested, and maintainable.

## Current Architecture

- **Framework:** Next.js (App Router), React, TypeScript
- **Rendering:** Server Components by default; client components only where interaction is required
- **Styling:** Tailwind CSS with design tokens; shadcn/ui-style primitives
- **Animation:** Framer Motion (transform/opacity only), respects `prefers-reduced-motion`
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Auth:** Server-side sessions; Argon2id password hashing
- **Validation:** Zod (server-authoritative)
- **Forms:** Server Actions + client validation for UX only
- **Storage:** Local `public/images` in dev; Vercel Blob-ready abstraction

## Important Design Decisions

1. Public pages read from the database — **no hard-coded production menu data in components**.
2. All mutations go through server code with explicit field allow-listing (mass-assignment protection).
3. Admin is a route group with server-side auth checks on **every** protected route and action — never rely on UI visibility alone.
4. Secrets live in env vars, server-only. Never `NEXT_PUBLIC_` for secrets.
5. Responses use a predictable shape `{ success, data }` / `{ success, error }`.
6. Soft delete (`deletedAt`) for dishes and categories; hard delete is admin-only with double confirmation.
7. Business info (name, phone, address, hours, socials) is centralized in the DB `Setting` model + `config/`.

## Database Rules

- All changes go through Prisma migrations. Never hand-edit the production schema.
- Unique constraints enforced in schema (category.slug, dish.slug, admin.email).
- Use transactions for multi-step writes (e.g. dish + image + audit log).
- Indexed fields: `categoryId`, `slug`, `isActive`, `isFeatured`, `sortOrder`, `createdAt`, `status`.
- Client never connects to the DB directly; browser → server → DB.

## Security Rules

- Argon2id for password hashing. Never store plaintext.
- Sessions: HttpOnly + Secure + SameSite=Lax cookies, server-side verification, expiry.
- Login errors are generic ("Invalid credentials") — no account enumeration.
- Rate limit: login, contact, admin mutations, all mutations.
- Validate **every** input server-side with Zod.
- Never log or return password hashes, tokens, or secrets.
- Sanitize all errors before they reach the client.
- Image uploads: validate type/MIME/size, generate safe filenames, allow-list formats.
- XSS: prefer plain text; never render unsanitized HTML.
- CSRF: same-site cookie checks + origin verification on mutations.

## Authentication Rules

- Admin credential model stores only `passwordHash`.
- Every protected route/action independently verifies session + role permission.
- Role permission checks via `hasPermission(role, permission)` helper.
- Logout invalidates the session server-side.

## UI Rules

- White/light base, warm cream secondary, deep charcoal text, muted earthy accent.
- Editorial serif display + clean sans body.
- Minimal, photographic, generous whitespace. No gratuitous glassmorphism/gradients.
- Mobile-first, tested 320px → 1920px.
- Consistent tokens for spacing/radius/shadow — no random values.
- Every interactive element is a real `<button>`/`<a>` with focus styles.
- Loading skeletons, empty states, and error states for every data view.

## Coding Conventions

- TypeScript strict. No `any` leakage across module boundaries.
- File names describe responsibility: `MenuCard.tsx`, `createDish.ts`, `validateContactForm.ts`.
- Server-only modules used from Server Components / Server Actions only.
- Human-readable names. No `x1`, `temp2`, `handleThingFinalNew`.

## Component Conventions

- Small components. Split when a file passes ~250 lines or has >1 concern.
- `components/ui/*` = primitives (Button, Input, Modal, Badge, Skeleton, Toast).
- Feature components under `components/{feature}/*`.
- No duplicate UI — reuse primitives.
- Comments explain *why*, never obvious *what*.

## API Conventions

- Route handlers return `{ success, data }` or `{ success: false, error: { code, message } }`.
- Never leak internal errors or stack traces.
- Audit-log every admin mutation.

## Do-Not List

- Do not expose secrets to the browser.
- Do not trust client-side validation alone.
- Do not blindly spread request bodies into DB updates.
- Do not create public admin APIs.
- Do not render unsanitized HTML.
- Do not add dependencies without a reason.
- Do not use fake data in production.
- Do not log passwords/tokens.

## Known Limitations

- Single-tenant (one café, one admin domain). Multi-location requires schema changes.
- Reservations, online ordering, payments, QR orders are **future** — not in v1.
- Image storage is local in dev; production uses Vercel Blob.

## Deployment Configuration

- Vercel production + previews. GitHub Actions CI (lint, typecheck, test, build).
- Env vars per environment: `DATABASE_URL`, `AUTH_SECRET`, `EMAIL_API_KEY`, `APP_URL`.
- Migrations run via `prisma migrate deploy` during deploy.

## Testing Requirements

- Run before merging: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
- Unit tests: validation, slug, permissions, formatting.
- Integration tests: DB operations, auth, rate limiting.
- Security tests: unauthorized access, IDOR, mass assignment, XSS/SQLi payloads.

## Current Project Status

See `docs/CHANGELOG.md` for the latest phase completion status.