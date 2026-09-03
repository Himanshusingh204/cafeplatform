# PROJECT_MASTER_BLUEPRINT.md — Spice & Saffron Master Plan & Architecture

> **Comprehensive Technical Blueprint, Current Implementation Audit, Operations Guide & Future Roadmap**  
> *Last Updated: September 2026*  
> *Status: Core System Production Ready · Expansion Phases Planned*

---

## Table of Contents
1. [Executive Summary & Tech Stack](#1-executive-summary--tech-stack)
2. [Admin Credentials & Panel Access](#2-admin-credentials--panel-access)
3. [Architecture & Folder Structure](#3-architecture--folder-structure)
4. [Completed Implementation Audit (Phases 1–20)](#4-completed-implementation-audit-phases-120)
5. [Database Schema & Data Models](#5-database-schema--data-models)
6. [Security, Performance & Resilience Architecture](#6-security-performance--resilience-architecture)
7. [Step-by-Step Production Deployment Playbook](#7-step-by-step-production-deployment-playbook)
8. [Future Feature Roadmap (Phases 21–30)](#8-future-feature-roadmap-phases-2130)
9. [Operational Cheat Sheet & Commands](#9-operational-cheat-sheet--commands)

---

## 1. Executive Summary & Tech Stack

**Spice & Saffron** is an authentic Indian café web application built on modern web development standards: server-first data fetching, high visual aesthetic, responsive layouts, and an administrative control panel.

### Technology Stack Overview
- **Framework**: Next.js 16.3.1 (App Router, Turbopack, Server Actions, Server Components)
- **Runtime**: Node.js v25+
- **Language**: TypeScript 5.8+ (strict type-checking, zero `any`)
- **Database & ORM**: PostgreSQL with Prisma 7.9+ (`@prisma/adapter-pg` driver adapter)
- **Styling**: Tailwind CSS v4 with custom warm-toned design tokens and typography
- **Authentication**: Custom session management using Argon2id password hashing + encrypted HTTP-only cookies
- **Validation**: Zod schema enforcement across server actions, APIs, and client inputs
- **Testing**: Vitest (16 test suites, 119 unit/integration/security tests) + Playwright for E2E
- **Icons & Animation**: Lucide React + custom CSS micro-animations & scroll reveals

---

## 2. Admin Credentials & Panel Access

### Production / Local Credentials
| Attribute | Configuration |
| :--- | :--- |
| **Admin Login URL** | `/admin/login` (`http://localhost:3000/admin/login`) |
| **Default Email** | `admin@spiceandsaffron.in` |
| **Default Password** | `ChangeMe123!` |
| **Role Level** | `SUPER_ADMIN` (full system access) |
| **Session Lifetime** | 8 hours (rolling refresh on activity) |
| **Rate Limit** | 5 failed attempts per 15 minutes before lock |

### Resetting Admin Password
To update or bootstrap the admin password at any time:
1. Ensure `ADMIN_EMAIL` and `ADMIN_PASSWORD` are set in `.env` or `.env.local`.
2. Run:
   ```powershell
   npx tsx scripts/create-admin.mjs
   ```

---

## 3. Architecture & Folder Structure

The project strictly follows a domain-driven, modular architecture:

```
cafe/
├── .github/
│   └── workflows/
│       ├── ci.yml                 # Lint, Typecheck, Test, Build automated pipeline
│       └── security.yml           # Vulnerability & secret scanning
├── app/
│   ├── (public)/                  # Public customer-facing routes
│   │   ├── about/page.tsx         # Story, values, kitchen details
│   │   ├── contact/page.tsx       # Hours, interactive map, contact form
│   │   ├── faq/page.tsx           # Searchable / accessible FAQ accordions
│   │   ├── gallery/page.tsx       # Masonry café photo gallery
│   │   ├── menu/                  # Menu browsing & dish details
│   │   │   ├── [slug]/page.tsx    # Individual dish deep-dive with JSON-LD
│   │   │   └── page.tsx           # Category-filtered menu display
│   │   ├── privacy/page.tsx       # Privacy policy
│   │   ├── terms/page.tsx         # Terms of service
│   │   ├── error.tsx              # Public route error boundary
│   │   ├── layout.tsx             # Public header/footer layout
│   │   └── page.tsx               # Homepage with hero, specials, story
│   ├── admin/                     # Protected administration panel
│   │   ├── (panel)/               # Authenticated admin shell
│   │   │   ├── activity/page.tsx  # Staff audit trail
│   │   │   ├── categories/page.tsx# Category CMS & sorting
│   │   │   ├── dishes/page.tsx    # Menu item CRUD & availability manager
│   │   │   ├── gallery/page.tsx   # Photo asset manager
│   │   │   ├── messages/page.tsx  # Customer inquiry inbox
│   │   │   ├── settings/page.tsx  # Restaurant settings & business hours
│   │   │   ├── layout.tsx         # Admin sidebar & header shell
│   │   │   ├── loading.tsx        # Skeleton loading fallback
│   │   │   └── page.tsx           # Operational KPI Dashboard
│   │   ├── actions/               # Server Actions with RBAC & audit logging
│   │   │   ├── categories.ts
│   │   │   ├── dishes.ts
│   │   │   ├── gallery.ts
│   │   │   ├── messages.ts
│   │   │   └── settings.ts
│   │   └── login/page.tsx         # Admin authentication portal
│   ├── api/                       # REST endpoints
│   │   ├── auth/                  # Login / logout handlers
│   │   ├── contact/               # Contact form ingestion & email trigger
│   │   ├── health/                # Liveness & database probe
│   │   └── notifications/         # SSE real-time notification stream
│   ├── globals.css                # Tailwind design system tokens
│   ├── layout.tsx                 # Root HTML & font configuration
│   ├── robots.ts                  # Dynamic robots.txt generator
│   └── sitemap.ts                 # Dynamic XML sitemap generator
├── components/
│   ├── about/                     # About values & kitchen components
│   ├── admin/                     # Admin managers (dishes, categories, etc.)
│   ├── brand/                     # SVG Logo & wordmark primitives
│   ├── contact/                   # Contact form with optimistic validation
│   ├── faq/                       # Accessible FAQ accordion list
│   ├── gallery/                   # Responsive photo grid
│   ├── home/                      # Hero, AboutPreview, Highlights, Reviews
│   ├── layout/                    # SiteHeader, SiteFooter, MobileNav
│   ├── menu/                      # MenuView, DishCard, DietaryTags
│   └── ui/                        # Reusable primitives (Button, Modal, etc.)
├── config/                        # Roles, navigation, site defaults, rate limits
├── docs/                          # Comprehensive technical documentation
├── lib/
│   ├── api/                       # Standard response & error handlers
│   ├── auth/                      # Argon2id passwords & cookie sessions
│   ├── db/                        # Prisma singleton client
│   ├── email/                     # Resend API integration
│   ├── generated/prisma/          # Generated Prisma Client
│   ├── rate-limit/                # Token bucket memory limiter
│   ├── services/                  # Database business logic & cache wrappers
│   ├── utils/                     # Formatting, slugify, cn helpers
│   └── validation/                # Zod request schemas
├── prisma/
│   ├── migrations/                # Database migration history
│   ├── schema.prisma              # Data definitions & indexes
│   └── seed.ts                    # Production & demo seed script
├── public/
│   └── images/                    # Hero, menu, about, and gallery imagery
└── tests/                         # Unit, integration, security & E2E tests
```

---

## 4. Completed Implementation Audit (Phases 1–20)

| Phase | Milestone | Scope Completed | Verification Status |
| :--- | :--- | :--- | :--- |
| **0–1** | **Foundations** | Next.js 16, TypeScript, Tailwind v4 design system, font tokens | ✅ Verified |
| **2** | **Database** | Prisma schema, PostgreSQL migrations, initial seed scripts | ✅ Verified |
| **3** | **Auth & Security** | Argon2id hashing, secure cookies, session rotation, RBAC guards | ✅ Verified |
| **4** | **Public Site** | Home, About, Menu, Gallery, Contact, FAQ, Privacy, Terms | ✅ Verified |
| **5** | **Menu CMS** | Categories CRUD, Dish CRUD, price compare, availability toggles | ✅ Verified |
| **6** | **Inquiries Inbox** | Contact form, honeypot spam protection, admin inbox management | ✅ Verified |
| **7** | **Admin Dashboard** | Real-time KPIs, dietary balance bars, category breakdown | ✅ Verified |
| **8** | **SEO & Meta** | Semantic HTML5, OpenGraph, JSON-LD Schema (Restaurant, Menu) | ✅ Verified |
| **9** | **Security Hardening** | CSP headers, XSS prevention, mass-assignment guards | ✅ Verified |
| **10** | **Performance** | Next/Image optimization, priority LCP loading, ISR caching | ✅ Verified |
| **11** | **Accessibility** | ARIA compliance, contrast audit, keyboard navigation | ✅ Verified |
| **12** | **Test Suites** | 16 Vitest suites covering auth, menu, security, CSRF, rates | ✅ 119/119 Passed |
| **13** | **CI/CD Pipeline** | GitHub Actions workflows for continuous verification | ✅ Configured |
| **14–17** | **Seed & Hardening** | Production seed with authentic menu items & photography | ✅ Verified |
| **18–20** | **Structural Polish** | Architecture alignment, modular components, DB fault fallbacks | ✅ Complete |

---

## 5. Database Schema & Data Models

### Entity Relationship Diagram
```mermaid
erDiagram
    Admin ||--o{ ActivityLog : performs
    Category ||--o{ Dish : contains
    Dish ||--o{ ActivityLog : tracks
    Category ||--o{ ActivityLog : tracks
    ContactMessage ||--o{ ActivityLog : tracks
    Setting ||--o{ ActivityLog : tracks

    Admin {
        string id PK
        string email UK
        string passwordHash
        string name
        enum role "SUPER_ADMIN | ADMIN | EDITOR"
        boolean isActive
        datetime createdAt
        datetime updatedAt
    }

    Category {
        string id PK
        string name
        string slug UK
        string description
        string image
        int sortOrder
        boolean isActive
        datetime deletedAt
        datetime createdAt
    }

    Dish {
        string id PK
        string categoryId FK
        string name
        string slug UK
        string shortDescription
        string description
        decimal price
        decimal compareAtPrice
        string image
        boolean isAvailable
        boolean isFeatured
        boolean isVegetarian
        boolean isVegan
        boolean isSpicy
        boolean containsNuts
        int preparationTime
        int calories
        int sortOrder
        datetime deletedAt
        datetime createdAt
    }

    GalleryImage {
        string id PK
        string title
        string altText
        string imageUrl
        enum category "INTERIOR | FOOD | KITCHEN | AMBIENCE"
        int sortOrder
        boolean isPublished
        datetime createdAt
    }

    ContactMessage {
        string id PK
        string name
        string email
        string phone
        string subject
        string message
        enum status "NEW | READ | REPLIED | ARCHIVED"
        string notes
        datetime createdAt
    }

    Setting {
        string key PK
        string value
        datetime updatedAt
    }

    ActivityLog {
        string id PK
        string actorId FK
        enum action "CREATE | UPDATE | DELETE | LOGIN | SETTINGS_CHANGED"
        string entityType
        string entityId
        json details
        datetime createdAt
    }
```

---

## 6. Security, Performance & Resilience Architecture

### Security Layers
1. **Password Hashing**: Uses state-of-the-art Argon2id with recommended memory and iteration parameters (`m=19456, t=2, p=1`).
2. **Session Guard**: Session tokens are cryptographically generated, signed with HMAC-SHA256, and stored in `HttpOnly`, `SameSite=Lax`, `Secure` cookies.
3. **Role-Based Access Control (RBAC)**:
   - `SUPER_ADMIN`: Full access to settings, staff, deletion, and menus.
   - `ADMIN`: Menu CRUD, inquiry management, gallery uploads.
   - `EDITOR`: Content updates, message review (no destructive deletion).
4. **Rate Limiting**: Token-bucket memory limiter prevents brute force attacks on `/api/auth/login` and spam submissions on `/api/contact`.
5. **Content Security Policy (CSP)**: Strict headers configured in `next.config.ts` prevent clickjacking, frame embedding, and malicious script injection.

### Database Outage Resilience
Every database service wrapper (`lib/services/menu.ts`, `gallery.ts`, `settings.ts`) implements fault-tolerant `try/catch` fallbacks. If the database undergoes network latency or temporary restart, the public site renders fallback content and default metadata instead of an unhandled HTTP 500 error.

---

## 7. Step-by-Step Production Deployment Playbook

### Step 1: Remote Repository Setup
1. Create a repository on GitHub (e.g. `github.com/your-username/spice-and-saffron`).
2. Add the remote and push code:
   ```bash
   git remote add origin https://github.com/your-username/spice-and-saffron.git
   git branch -M main
   git push -u origin main
   ```

### Step 2: Database Provisioning
Choose any hosted PostgreSQL provider:
- **Prisma Postgres / Neon / Supabase / Render / AWS RDS**
- Retrieve the connection URL with SSL enabled:
  `postgresql://user:password@host:5432/dbname?sslmode=require`

### Step 3: Vercel Deployment
1. Import the repository in [Vercel Dashboard](https://vercel.com/new).
2. Configure the Environment Variables:
   - `DATABASE_URL`: Hosted PostgreSQL connection string
   - `AUTH_SECRET`: Strong 32-character random key (`openssl rand -base64 32`)
   - `APP_URL`: Your live domain (e.g. `https://spiceandsaffron.in`)
   - `ADMIN_EMAIL`: Initial admin login email
   - `ADMIN_PASSWORD`: Initial secure password
   - `EMAIL_API_KEY`: *(Optional)* Resend API key for inquiry email forwarding
   - `CONTACT_NOTIFY_EMAIL`: *(Optional)* Destination inbox for customer contact alerts
3. Click **Deploy**.

### Step 4: Run Migrations and Seed
In Vercel Build Command or via CLI connected to the production database:
```bash
npx prisma migrate deploy
SEED_DEMO_DATA=true npx tsx prisma/seed.ts
```

---

## 8. Future Feature Roadmap (Phases 21–30)

```mermaid
timeline
    title Expansion Roadmap (Phases 21-30)
    Phase 21 : Table Reservation System : SMS/WhatsApp confirmations
    Phase 22 : Online Ordering & Cart : Razorpay & Stripe integration
    Phase 23 : Customer Reviews & Ratings : Admin moderation workflow
    Phase 24 : Multi-Staff Roles : Kitchen Display Screen & Waitstaff view
    Phase 25 : Daily Specials Scheduler : Automated time-based menu badges
    Phase 26 : Multi-language Support : English & Hindi localization
    Phase 27 : Loyalty & Coupon Engine : Promotional discount codes
    Phase 28 : Progressive Web App (PWA) : Offline caching & installable app
    Phase 29 : Revenue & Sales Analytics : Dish profitability metrics
    Phase 30 : AI Menu Concierge : Dietary & wine/chai pairing assistant
```

### Phase 21: Table Reservation & Booking System
- **Objective**: Allow guests to book dining slots online.
- **Components**: Date & time slot picker, party size selector, table allocation logic.
- **Integrations**: Twilio / WhatsApp Business API for instant reservation SMS confirmations.

### Phase 22: Online Ordering & Takeaway
- **Objective**: Direct takeaway orders with payment gateway.
- **Components**: Cart drawer, order summary, pickup time estimate.
- **Integrations**: Razorpay (India) and Stripe (International cards).

### Phase 23: Customer Reviews & Social Proof
- **Objective**: Verified guest feedback directly on dish pages.
- **Components**: Star rating widget, customer comments, admin moderation queue before publishing.

### Phase 24: Kitchen Display System (KDS) & Waitstaff View
- **Objective**: Lightweight live view for kitchen staff on tablet devices.
- **Components**: Fullscreen live orders board, preparation timer, "Mark Ready" button with real-time SSE updates.

### Phase 25: Daily Specials & Seasonal Scheduler
- **Objective**: Automated calendar-based dish promotions.
- **Components**: Schedule a dish to be featured during specific date ranges (festivals, weekends, seasonal ingredients).

### Phase 26: Multi-Language Localization
- **Objective**: Dual language support for Hindi and English.
- **Components**: `next-intl` integration with language toggle in header and localized dish descriptions.

### Phase 27: Loyalty & Discount Coupons Engine
- **Objective**: Promotional discounts for regular diners.
- **Components**: Percentage / fixed amount coupon codes, usage limits, minimum order values.

### Phase 28: Mobile PWA (Progressive Web App)
- **Objective**: Fast, installable app experience on iOS and Android.
- **Components**: Web manifest, service worker offline caching, push notifications for daily lunch specials.

### Phase 29: Business Intelligence & Revenue Analytics
- **Objective**: Understand top-selling dishes and revenue trends.
- **Components**: Sales charts, category revenue breakdown, average ticket size, and quiet hour analysis.

### Phase 30: AI Menu Concierge / Pairings Assistant
- **Objective**: Conversational recommendation engine for customers.
- **Components**: Recommends curries based on spice preference, dietary allergies, and ideal bread/beverage pairings.

---

## 9. Operational Cheat Sheet & Commands

### Routine Commands
| Task | Terminal Command |
| :--- | :--- |
| **Start Development Server** | `npm run dev` (runs on port 3000) |
| **Run Unit & Integration Tests** | `npm test` |
| **Run Linter** | `npm run lint` |
| **Verify TypeScript Types** | `npm run typecheck` |
| **Compile Production Build** | `npm run build` |
| **Create / Update Admin Account** | `npx tsx scripts/create-admin.mjs` |
| **Inspect Database GUI** | `npx prisma studio` |
| **Apply New DB Migrations** | `npx prisma migrate dev` |
| **Deploy Migrations (Production)**| `npx prisma migrate deploy` |
| **Re-seed Database** | `SEED_DEMO_DATA=true npx tsx prisma/seed.ts` |

---
*For questions or architecture discussions, refer to [docs/ARCHITECTURE.md](file:///i:/Web%20devlopment/cafe/docs/ARCHITECTURE.md) and [docs/DEPLOYMENT.md](file:///i:/Web%20devlopment/cafe/docs/DEPLOYMENT.md).*
