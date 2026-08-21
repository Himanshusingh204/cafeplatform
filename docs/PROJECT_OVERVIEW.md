# PROJECT_OVERVIEW.md — Indian Café Website

## What is the product?

A premium, minimalist Indian café website with a private admin dashboard. Visitors see a beautiful,
fast menu-driven site; the owner manages everything through a secure CMS.

## Who uses it?

- **Visitors** (unauthenticated): browse menu, gallery, about, contact, FAQ.
- **Admin / café owner** (authenticated): manage dishes, categories, gallery, messages, settings, activity logs.

## What pages exist?

### Public
- `/` — Home (hero, signature dishes, about preview, gallery preview, reviews, location CTA)
- `/about` — Story, philosophy, team, atmosphere
- `/menu` — Database-driven menu with category filtering
- `/menu/[slug]` — Single dish detail
- `/gallery` — Photographs of the café
- `/contact` — Contact info + form
- `/faq` — Frequently asked questions
- `/privacy` — Privacy policy
- `/terms` — Terms & conditions
- 404 page, error page, loading states

### Admin (private)
- `/admin/login` — Secure login
- `/admin` — Dashboard overview (stats, recent activity)
- `/admin/menu` — Categories + dishes management
- `/admin/categories` — Category CRUD
- `/admin/dishes` — Dish CRUD (create/edit/delete/publish/feature/reorder)
- `/admin/gallery` — Gallery upload + manage
- `/admin/messages` — Contact submissions + status workflow
- `/admin/settings` — Site settings (business info)
- `/admin/activity` — Audit logs

## What does the admin do?

Login, manage the full menu, publish/unpublish dishes, mark featured dishes, upload gallery images,
read and respond to contact messages, update business settings, and review activity logs.

## What data exists?

- `Admin` (email, passwordHash, role, active)
- `Category` (name, slug, description, image, isActive, sortOrder)
- `Dish` (name, slug, description, price, compareAtPrice, image, dietary tags, availability, sortOrder)
- `GalleryImage` (title, altText, imageUrl, category, sortOrder, isPublished)
- `ContactMessage` (name, email, phone, subject, message, status, ipHash)
- `ActivityLog` (actorId, action, entityType, entityId, metadata, timestamp)
- `Setting` (key, value — café name, phone, address, hours, socials)
- `Session` (token, adminId, expiresAt)

## What technologies are used?

Next.js (App Router) · TypeScript · React Server Components · Tailwind CSS · Framer Motion ·
Prisma · PostgreSQL · Zod · Argon2id · Server Actions/API routes · GitHub Actions.

## How does the application flow work?

1. **Visitor** requests a page → Next.js Server Component → server-side data fetch → Prisma → PostgreSQL → HTML sent to browser.
2. **Contact form** → client validation → server action → Zod validation → rate limit → DB insert → admin notification.
3. **Admin** → login (Argon2id verify) → HttpOnly session → protected dashboard → validated mutations → audit log.

## What is finished?

Tracked phase-by-phase in `docs/CHANGELOG.md`. As of the current build: see CHANGELOG.

## What remains?

Reservations, online ordering, payments, QR menus, multi-location — all deliberately out of v1 scope.