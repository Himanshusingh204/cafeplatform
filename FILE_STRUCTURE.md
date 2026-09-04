# 📂 Repository File Structure & Architectural Guide

**Spice & Saffron — Enterprise Indian Fine Dining & Platform Architecture**

This document provides an exhaustive map of the project layout, directory responsibilities, and coding conventions across the decoupled architecture.

---

## 🏛 Directory Hierarchy Overview

```
cafe/
├── app/                          # Next.js 16 App Router (Frontend Presentation Tier)
│   ├── (public)/                 # Customer-facing public application routes
│   │   ├── about/                # Brand heritage, culinary philosophy
│   │   ├── checkout/             # Cart review, takeaway ordering, payment modal
│   │   ├── contact/              # Map, address, opening hours, inquiry form
│   │   ├── faq/                  # Dining FAQ & policies
│   │   ├── gallery/              # Full-screen culinary photography showcase
│   │   ├── menu/                 # Categorized menu with dietary filters & search
│   │   │   └── [slug]/           # Dynamic dish detail page (nutrition, allergens, add button)
│   │   ├── order/
│   │   │   └── [id]/             # Live customer takeaway tracker (4-stage status & audio chime)
│   │   ├── privacy/              # GDPR / Privacy policy
│   │   ├── reservations/         # Interactive table booking & lookup
│   │   ├── terms/                # Terms of service
│   │   └── page.tsx              # Luxury Home Page landing experience
│   ├── admin/                    # Role-Gated Administrative CMS
│   │   ├── (panel)/              # Authenticated Admin Panel layouts & pages
│   │   │   ├── activity/         # Immutable audit activity trail
│   │   │   ├── categories/       # Menu course & section manager
│   │   │   ├── coupons/          # Promotional discounts & coupon codes portal
│   │   │   ├── developers/       # S2S API keys & webhook management
│   │   │   ├── dishes/           # Dish catalog CRUD & availability toggles
│   │   │   ├── gallery/          # Visual asset & cloud image manager
│   │   │   ├── kds/              # Real-Time Kitchen Display System board
│   │   │   ├── messages/         # Customer inquiries & reply inbox
│   │   │   ├── orders/           # Takeaway order dispatch & fulfillment
│   │   │   ├── reservations/     # Table reservations & hostess scheduler
│   │   │   ├── reviews/          # Customer review moderation
│   │   │   ├── settings/         # Operating hours, restaurant profile overrides
│   │   │   └── page.tsx          # Executive Operations Command Center
│   │   ├── actions/              # Admin-only server actions with RBAC guards
│   │   │   ├── api-keys.ts       # S2S API key generation & revocation
│   │   │   ├── categories.ts     # Category mutations
│   │   │   ├── coupons.ts        # Promo code CRUD actions
│   │   │   ├── dishes.ts         # Dish mutations & soft-delete
│   │   │   ├── gallery.ts        # Image uploads & deletion
│   │   │   ├── messages.ts       # Message status transitions
│   │   │   ├── orders.ts         # Order lifecycle transitions
│   │   │   ├── reservations.ts   # Table booking confirmations/cancellations
│   │   │   ├── reviews.ts        # Review approval/rejection
│   │   │   ├── settings.ts       # Store profile mutations
│   │   │   └── webhooks.ts       # Outbound webhook registrations
│   │   └── login/                # Hardened admin authentication portal
│   ├── api/                      # Next.js Route Handlers (REST & Webhooks)
│   │   ├── auth/                 # Login & logout endpoints
│   │   ├── contact/              # Anti-bot public contact submission
│   │   ├── health/               # Service & DB health check
│   │   ├── notifications/        # SSE event stream for admin alerts
│   │   ├── upload/               # Image upload with MIME & size validation
│   │   └── v1/                   # Versioned B2B S2S Gateway
│   │       ├── menu/             # Machine-to-machine menu sync
│   │       ├── orders/           # External order ingestion & status API
│   │       │   └── [id]/         # Single order lifecycle updates
│   │       ├── realtime/kds/     # SSE live kitchen stream
│   │       ├── reservations/     # Partner booking API
│   │       └── webhooks/         # Webhook ingress (payments & partners)
│   │           ├── ingress/      # Outbound partner callback receiver
│   │           └── payment/      # Idempotent Razorpay/Stripe webhook handler
│   ├── globals.css               # Tailwind CSS v4 design system tokens
│   ├── layout.tsx                # Root layout, Google fonts, metadata, cart drawer
│   ├── not-found.tsx             # Branded 404 page
│   ├── robots.ts                 # SEO crawlers configuration
│   └── sitemap.ts                # Dynamic XML sitemap generator
├── components/                   # Reusable UI & Domain Components
│   ├── admin/                    # Admin CMS management components (Shell, KDS, Tables)
│   ├── brand/                    # LogoMark, Wordmark, Brand icons
│   ├── cart/                     # Shopping bag drawer, item counter, order summary
│   ├── home/                     # Hero, Featured Dishes, Why Visit, About Preview
│   ├── layout/                   # Header, SiteNav, Footer, MobileNav
│   ├── menu/                     # DishCard, DishTags, DietaryFilter, DishAddButton
│   ├── order/                    # OrderLiveTracker with Web Audio chime
│   ├── reservations/             # Booking form, date picker, ReservationLookup
│   ├── reviews/                  # ReviewsSection, StarRating, ReviewFormModal
│   └── ui/                       # Atomic UI primitives (Button, Modal, Input, Reveal)
├── config/                       # Static Application Configurations
│   ├── limits.ts                 # Rate limit thresholds & time windows
│   ├── navigation.ts             # Public and Admin navigation links
│   ├── roles.ts                  # RBAC permissions and role matrix
│   └── site.ts                   # Brand metadata, SEO defaults, social handles
├── hooks/                        # Custom React Hooks
│   ├── use-cart.ts               # Persistent shopping cart state
│   ├── use-media-query.ts        # Responsive breakpoint detector
│   └── use-notifications.ts      # Server-Sent Events notification subscriber
├── lib/                          # Core Business Logic & Infrastructure Layer
│   ├── actions/                  # Public server actions (orders, payments, reservations)
│   ├── api/                      # Request extraction, CORS, response helpers
│   ├── auth/                     # Argon2id hashing, session verification, S2S HMAC guards
│   ├── db/                       # Prisma client singleton & multi-tenant resolver
│   ├── email/                    # Resend email notifier (receipts, confirmations)
│   ├── payments/                 # Unified FinTech payment engine (Razorpay & Stripe)
│   ├── rate-limit/               # Token-bucket sliding window limiter
│   ├── realtime/                 # Distributed event bus for SSE & WebSockets
│   ├── services/                 # Domain business services (Orders, Menu, Bookings)
│   ├── utils/                    # Formatting (currency, dates, strings)
│   └── validation/               # Zod validation schemas
├── prisma/                       # Database Schema & Migrations
│   ├── migrations/               # Version-controlled SQL migration history
│   ├── schema.prisma             # PostgreSQL schema definition
│   └── seed.ts                   # Initial data seeder (dishes, admin, categories)
├── public/                       # Static Assets
│   └── images/                   # High-definition culinary photography & screenshots
├── scripts/                      # Operational Automation Scripts
│   ├── create-admin.mjs          # Admin user bootstrap utility
│   └── verify-deployment.mjs     # Pre-flight deployment verification
├── server/                       # Standalone Backend Service (Port 4000)
│   └── api.ts                    # Dedicated API entrypoint for Port 4000
└── tests/                        # Automated Quality Assurance Suites
    ├── integration/              # Database & API integration tests
    ├── security/                 # OWASP payload & mass-assignment tests
    └── unit/                     # Business logic & payment cryptographic tests
```

---

## 📐 Architectural Conventions & Boundaries

### 1. Separation of Concerns
* **Presentation Layer (`app/`, `components/`)**: Never interacts directly with database connections. Consumes Server Actions (`lib/actions/`), Backend API routes, or Domain Services (`lib/services/`).
* **Service Layer (`lib/services/`)**: Pure TypeScript business logic enforcing domain rules (authoritative pricing, stock availability, validation).
* **Data Access Layer (`lib/db/prisma.ts`)**: Single shared Prisma instance configured with connection pooling and type adapters.

### 2. Multi-Port Strategy
* **Port 3000**: Next.js App Router (Customer Web Experience & Admin Management UI).
* **Port 4000**: Standalone REST & S2S API Service with CORS headers enabled for `http://localhost:3000`.

### 3. Security Guidelines
* Never commit `.env` or `.env.local`. Keep placeholders synchronized in `.env.example`.
* Never touch `PERSONAL DO NOT TOUCH.txt`.
* Always use constant-time comparisons (`crypto.timingSafeEqual`) for HMAC signatures and tokens.
