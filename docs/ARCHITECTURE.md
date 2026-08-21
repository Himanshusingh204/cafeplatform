# ARCHITECTURE.md — Technical Architecture

## High-Level View

```
Browser
   │
   ▼
Next.js (App Router)
   │  ├── Server Components (public pages, data fetch)
   │  ├── Server Actions (mutations: contact, admin CRUD)
   │  └── Route Handlers (api/auth, api/health, api/upload)
   │
   ▼
lib/ layers: auth → authorization → rate-limit → validation (Zod) → business logic → Prisma
   │
   ▼
PostgreSQL
```

The browser never connects directly to the database. Every mutation passes through
authentication → authorization → rate limiting → validation → business logic → audit log.

## Folder Structure

```
app/
  (public)/            # Public pages group
  admin/               # Admin route group (server-protected)
  api/                 # Route handlers (auth, health, contact)
  error.tsx            # Root error boundary
  not-found.tsx        # 404
  loading.tsx          # Root loading
  sitemap.ts           # XML sitemap
  robots.ts            # robots.txt
  layout.tsx           # Root layout (fonts, metadata, header/footer)
components/
  ui/                  # Primitives: Button, Input, Modal, Badge, Skeleton, Toast...
  layout/              # Header, Footer, MobileNav
  home/  menu/  about/  gallery/  contact/  faq/  admin/
config/                # site.ts, navigation.ts, seo.ts, limits.ts
hooks/                 # useDebounce, useMediaQuery, useMounted...
lib/
  auth/                # sessions, passwords (Argon2id), permissions
  db/                  # Prisma client singleton
  security/            # headers, sanitization, ip handling
  validation/          # Zod schemas
  rate-limit/          # in-memory token-bucket limiter
  logger/              # structured logger (server only)
  utils/               # slugify, formatPrice, cn, requestId
prisma/                # schema.prisma, migrations, seed.ts
public/images/         # hero/, menu/, gallery/, about/, placeholders/, brand/
tests/                 # unit/, integration/, security/
docs/                  # AI memory system
.github/workflows/     # CI + security + deployment-check
```

## Data Flow

### Public
Visitor → Next.js page (Server Component) → `getMenu()` service → Prisma → PostgreSQL → minimal HTML/data to browser.

### Admin
Admin → login → auth service → session cookie → protected layout (server check) → dashboard →
mutation (Server Action/route) → `requireAuth` → `hasPermission` → rate limit → Zod parse →
service function → Prisma transaction → audit log → response.

## Key Decisions

- **Server-first:** data fetching and mutations on the server. Client components are thin.
- **Single Prisma client** singleton to avoid connection exhaustion.
- **Session store in DB** (Session table) for server-side invalidation and logout.
- **In-memory rate limiter** in dev/preview; swappable for Upstash/Redis in production.
- **Soft delete** for menu records via `deletedAt`.
- **Image abstraction:** `lib/storage` exposes `saveImage()` / `deleteImage()` so local dev and Vercel Blob share one interface.