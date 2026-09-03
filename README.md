<div align="center">

# 🌿 Spice & Saffron (मसाला और केसर)
### Production-Grade, Full-Stack Indian Fine Dining & Artisan Café Platform

[![Next.js](https://img.shields.io/badge/Next.js-16.3-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue?style=for-the-badge&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38bdf8?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![Prisma](https://img.shields.io/badge/Prisma-v7-2D3748?style=for-the-badge&logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18-336791?style=for-the-badge&logo=postgresql)](https://www.postgresql.org/)
[![Security](https://img.shields.io/badge/Security-Argon2id_%7C_RBAC-brightgreen?style=for-the-badge&logo=shield)](https://cheatsheetseries.owasp.org/)
[![Tests](https://img.shields.io/badge/Testing-Vitest_%7C_Playwright-orange?style=for-the-badge&logo=vitest)](https://vitest.dev/)

<br />

<img src="public/images/screenshots/banner.jpg" alt="Spice & Saffron Showcase Banner" width="100%" style="border-radius: 12px; box-shadow: 0 20px 40px rgba(0,0,0,0.5);" />

<br />

**[Key Features](#-key-features)** • **[System Architecture](#-system-architecture)** • **[Visual Showcase](#-visual-showcase)** • **[Security Architecture](#-security--data-privacy-architecture)** • **[Database Design](#-database-schema--domain-model)** • **[Getting Started](#-getting-started)** • **[Testing](#-testing--quality-assurance)** • **[V2 Scaling Roadmap](#-v2-milestone--scaling-roadmap-b2b-saas-s2s--websockets)**

</div>

---

## 📌 Executive Summary & Resume Highlights

**Spice & Saffron** is an enterprise-grade, full-stack web application designed for a luxury culinary brand. Built with **Next.js 16 (App Router)**, **React 19 Server Components**, **TypeScript**, **Tailwind CSS v4**, and **Prisma 7 on PostgreSQL**, it pairs a high-conversion, editorial public web application with a secure, role-based Admin Content Management System (CMS).

### 💼 Technical Competencies Demonstrated:
- **Scalable Next.js 16 App Architecture**: Hybrid React Server Components (RSC) paired with isolated interactive client islands for sub-second Initial Server Response (TTFB) and zero bundle bloat.
- **Enterprise-Grade Cybersecurity**: Implements OWASP-recommended security practices—**Argon2id password hashing**, cryptographic session hashing in PostgreSQL, strict **Role-Based Access Control (RBAC)**, HMAC CSRF protection, and token-bucket rate limiting.
- **Resilient Data Layer**: Relational schema modeled in **Prisma 7** and **PostgreSQL 18** featuring ACID compliance, foreign key constraints, cascade safety, soft deletions, and immutable audit logs.
- **Production DevOps & QA**: Automated CI workflows, comprehensive unit and integration suites with **Vitest**, browser regression tests with **Playwright**, and environment variable isolation.

---

## 📸 Visual Showcase

### 1. Landing & Editorial Experience
> Hero storytelling with dynamic featured dish showcases, artisan heritage previews, and fluid entrance micro-interactions.

<img src="public/images/screenshots/01-home-hero.png" alt="Homepage Hero Preview" width="100%" style="border-radius: 8px; border: 1px solid #333;" />

<br />

### 2. Interactive Culinary Menu & Filtering
> Server-rendered menu catalog with real-time dietary filtering, spice level indicators, and instantaneous cart actions.

<img src="public/images/screenshots/02-menu-page.png" alt="Culinary Menu" width="100%" style="border-radius: 8px; border: 1px solid #333;" />

<br />

### 3. Real-Time Table Reservation Engine
> Interactive booking engine with server-side slot availability validation, guest count allocation, and automated status handling.

<img src="public/images/screenshots/03-reservations.png" alt="Table Reservations" width="100%" style="border-radius: 8px; border: 1px solid #333;" />

<br />

### 4. Artisan Story, Heritage & Gallery
> High-definition visual storytelling highlighting kitchen craftsmanship, tandoor traditions, and restaurant ambiance.

| **Heritage & Story** | **Artisan Photo Gallery** |
| :---: | :---: |
| <img src="public/images/screenshots/04-about-story.png" alt="About Story" width="100%" style="border-radius: 6px;" /> | <img src="public/images/screenshots/05-gallery.png" alt="Gallery Grid" width="100%" style="border-radius: 6px;" /> |

<br />

### 5. Customer Touchpoints & Hardened Admin CMS
> Dedicated contact & geolocation touchpoint alongside an isolated, role-protected administrative portal.

| **Contact & Concierge** | **Admin Authentication Portal** |
| :---: | :---: |
| <img src="public/images/screenshots/06-contact.png" alt="Contact Page" width="100%" style="border-radius: 6px;" /> | <img src="public/images/screenshots/07-admin-login.png" alt="Admin Login Portal" width="100%" style="border-radius: 6px;" /> |

---

## 🏛 System Architecture

The application adopts a clean, layered architecture separating presentations, security gates, domain logic, and data persistence:

```mermaid
flowchart TD
    subgraph Client["🖥️ Client Tier (Browser)"]
        UI["React 19 Server & Client Components"]
        CartState["Client Cart Store (Hooks)"]
        Motion["Fluid Entrance Micro-Animations"]
    end

    subgraph Edge["🛡️ Edge & Security Gate"]
        Proxy["Next.js Proxy / Middleware Gate"]
        RateLimiter["Token-Bucket Rate Limiter (Upstash / Memory)"]
        SessionCheck["Cookie Inspection (HttpOnly, Secure, Lax)"]
    end

    subgraph AppTier["⚙️ Application & Server Tier"]
        RSC["Server Component Renderers (SSR / ISR)"]
        ServerActions["Server Actions & API Handlers"]
        Zod["Zod Validation & Payload Sanitization"]
        RBAC["Role-Based Access Control (SUPER_ADMIN / ADMIN / EDITOR)"]
    end

    subgraph ServiceLayer["📦 Domain Services"]
        MenuService["Menu & Dishes Service"]
        OrderService["Orders & Checkout Engine"]
        ReserveService["Table Reservation Engine"]
        ReviewService["Reviews & Moderation Service"]
        AuditService["Audit Trail Logger"]
    end

    subgraph DataTier["🗄️ Persistence & Infrastructure"]
        Prisma["Prisma ORM 7 Engine"]
        Postgres[(PostgreSQL 18 Database)]
        Resend["Transactional Mail (Resend API)"]
        Storage["Object Storage / Cloud Assets"]
    end

    UI -->|HTTP / HTTPS| Proxy
    Proxy --> SessionCheck
    SessionCheck --> RateLimiter
    RateLimiter --> RSC
    RateLimiter --> ServerActions

    ServerActions --> Zod
    Zod --> RBAC
    RBAC --> ServiceLayer
    RSC --> ServiceLayer

    ServiceLayer --> Prisma
    ServiceLayer --> Resend
    ServiceLayer --> Storage
    Prisma --> Postgres
```

---

## 🔐 Security & Data Privacy Architecture

This platform was built adhering to strict **Zero-Trust** and **Defense-in-Depth** principles:

| Domain | Implementation | Security Benefit |
| :--- | :--- | :--- |
| **Password Security** | **Argon2id** (memory-hard password hashing with salt) | Immune to GPU-accelerated brute force and rainbow table attacks. Plaintext is never persisted. |
| **Session Model** | 256-bit cryptographically secure random token (`crypto.randomBytes`) | Stored in PostgreSQL as a **SHA-256 hash**. Cookie is flagged `HttpOnly`, `Secure`, `SameSite=Lax`. |
| **RBAC Authorization** | Multi-level hierarchy: `SUPER_ADMIN` > `ADMIN` > `EDITOR` | Every admin page and Server Action verifies role authorization independently of client state. |
| **Anti-Abuse / DoS** | Token-bucket rate limiter with Upstash Redis integration + memory fallback | Throttles brute-force attempts on login, contact forms, and order mutations. |
| **Bot Defenses** | Honeypot fields + dynamic time-to-submit verification | Blocks automated spam submissions without compromising accessibility. |
| **Injection Defense** | Server-authoritative **Zod schemas** + **Prisma Parameterized Queries** | Eliminates SQL Injection (SQLi) and Mass-Assignment vulnerabilities. |
| **Data Privacy** | Strict `.gitignore` enforcement for all `.env*` files & personal files | Guarantees zero secret leakage to public version control. Sanitized `.env.example` provided. |

---

## 🗄 Database Schema & Domain Model

The database is modeled with strict relational integrity using PostgreSQL and Prisma ORM:

```mermaid
erDiagram
    Admin ||--o{ Session : "has active"
    Admin ||--o{ AuditLog : "triggers"
    Category ||--o{ Dish : "contains"
    Order ||--o{ OrderItem : "includes"
    Dish ||--o{ OrderItem : "referenced by"

    Admin {
        string id PK
        string email UK
        string passwordHash
        string role "SUPER_ADMIN | ADMIN | EDITOR"
        boolean isActive
        datetime createdAt
    }

    Session {
        string id PK
        string tokenHash UK
        string adminId FK
        datetime expiresAt
        datetime createdAt
    }

    Category {
        string id PK
        string name
        string slug UK
        int sortOrder
        boolean isVisible
        datetime deletedAt
    }

    Dish {
        string id PK
        string categoryId FK
        string name
        string slug UK
        string description
        decimal price
        string imageUrl
        boolean isFeatured
        boolean isAvailable
        datetime deletedAt
    }

    Reservation {
        string id PK
        string customerName
        string customerEmail
        string customerPhone
        int guestCount
        datetime reservationDate
        string timeSlot
        string status "PENDING | CONFIRMED | CANCELLED"
        string notes
    }

    Order {
        string id PK
        string customerName
        string customerEmail
        string customerPhone
        string orderType "DINE_IN | TAKEAWAY | DELIVERY"
        string status "PENDING | PREPARING | READY | COMPLETED"
        decimal totalAmount
        string paymentStatus
    }

    OrderItem {
        string id PK
        string orderId FK
        string dishId FK
        int quantity
        decimal unitPrice
    }

    Review {
        string id PK
        string authorName
        int rating "1 to 5"
        string comment
        boolean isApproved
        datetime createdAt
    }

    AuditLog {
        string id PK
        string adminId FK
        string action
        string entity
        string entityId
        json diff
        datetime createdAt
    }
```

---

## ⚡ Key Features

### 🌟 Public Storefront
- **Dynamic Menu Explorer**: Categorized dishes with dietary tags (Vegetarian, Vegan, Gluten-Free, Halal, Jain).
- **Interactive Cart & Order Processing**: Local storage state persistence with instant price calculation.
- **Table Reservations**: Date & time slot picker with server-side validation against restaurant capacity.
- **Verified Customer Reviews**: Community review submission system with administrative moderation.
- **SEO & Social Share Ready**: Server-rendered OpenGraph metadata, dynamic `sitemap.ts`, and structured schema.

### 🛡️ Admin CMS (Control Panel)
- **Live Metrics Dashboard**: Real-time sales, order counts, pending reservations, and active reviews.
- **Menu Management**: Create, edit, toggle availability, and soft-delete dishes and categories.
- **Reservation Workflow**: Accept, reschedule, or cancel bookings with automatic guest notifications.
- **Order Tracking**: Status lifecycle updates (`PENDING` ➔ `PREPARING` ➔ `READY` ➔ `DELIVERED`).
- **Comprehensive Audit Trail**: Every administrative action is permanently logged with IP and user metadata.

---

## 🛠️ Tech Stack & Engineering Decisions

| Technology | Purpose | Key Rationale |
| :--- | :--- | :--- |
| **Next.js 16** | Full-stack Web Framework | App Router with Turbopack for lightning-fast HMR and streaming SSR. |
| **React 19** | Component Architecture | First-class Server Components (RSC) and Actions for seamless mutations. |
| **TypeScript 5** | Strict Type Safety | Complete end-to-end type soundness from database queries to UI components. |
| **Tailwind CSS v4** | Modern Design System | CSS-first tokens, dark luxury palette, zero-runtime overhead. |
| **Prisma 7** | Type-Safe ORM | Auto-generated TypeScript types, declarative migrations, connection pooling. |
| **PostgreSQL 18** | Relational Database | ACID transactions, robust foreign keys, fast indexing on slugs & IDs. |
| **Argon2id** | Cryptographic Hashing | Memory-hard password protection matching highest NIST/OWASP standards. |
| **Zod 4** | Runtime Validation | Type-inferred server-authoritative request parsing and form validation. |
| **Vitest & Playwright** | Automated QA | High-speed unit tests combined with end-to-end multi-browser test coverage. |

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: `v20.x` or higher
- **PostgreSQL**: `v14.x` or higher (running locally or cloud instance)
- **npm** or **pnpm**

### 2. Clone and Install
```bash
git clone https://github.com/your-username/spice-and-saffron.git
cd spice-and-saffron
npm install
```

### 3. Configure Environment Variables
Copy the template configuration:
```bash
cp .env.example .env.local
```
Configure your credentials in `.env.local`:
```env
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/indian_cafe?schema=public"

# Session Security (Generate with: openssl rand -base64 32)
AUTH_SECRET="your-32-character-secret-key-here"

# Canonical URL
APP_URL="http://localhost:3000"

# Optional Integrations
EMAIL_API_KEY=""
CONTACT_NOTIFY_EMAIL=""
UPSTASH_REDIS_REST_URL=""
UPSTASH_REDIS_REST_TOKEN=""
```

### 4. Database Setup & Seeding
```bash
# Apply migrations to database
npx prisma migrate deploy

# Seed initial settings and baseline data
npm run db:seed
```
> **Tip**: To seed complete demo dishes, categories, and reviews, set `SEED_DEMO_DATA="true"` in your `.env.local` before running `npm run db:seed`.

### 5. Create First Admin Account
```bash
ADMIN_EMAIL="admin@spiceandsaffron.com" ADMIN_PASSWORD="YourSecurePassword123!" npm run create-admin
```

### 6. Run the Application
```bash
npm run dev
```
- **Public Website**: [http://localhost:3000](http://localhost:3000)
- **Admin Control Panel**: [http://localhost:3000/admin/login](http://localhost:3000/admin/login)

---

## 🧪 Testing & Quality Assurance

Quality gates are strictly enforced before any deployment:

```bash
# 1. Type verification
npm run typecheck

# 2. ESLint code standard check
npm run lint

# 3. Unit & Integration tests (Vitest)
npm test

# 4. End-to-End Browser tests (Playwright)
npm run test:e2e
```

---

## 📦 Project Structure

```
├── app/
│   ├── (public)/              # Public customer-facing routes (SSR / ISR)
│   │   ├── about/             # Heritage & story page
│   │   ├── checkout/          # Cart review & ordering
│   │   ├── contact/           # Location & inquiry form
│   │   ├── gallery/           # Visual photo showcase
│   │   ├── menu/              # Interactive menu catalog
│   │   ├── reservations/      # Table booking engine
│   │   └── page.tsx           # Home landing page
│   ├── admin/                 # Protected Administrative CMS
│   │   ├── (panel)/           # Dashboard, dishes, orders, reviews, settings
│   │   ├── actions/           # Authoritative Server Actions
│   │   └── login/             # Secure admin authentication
│   ├── api/                   # REST / Route Handlers (Auth, Upload, Notifications)
│   ├── globals.css            # Tailwind CSS v4 design system tokens
│   └── layout.tsx             # Root HTML layout with SEO fonts & metadata
├── components/
│   ├── admin/                 # CMS management tables, dialogs, uploader
│   ├── cart/                  # Shopping cart drawer & checkout widgets
│   ├── home/                  # Hero, featured dishes, why-visit modules
│   ├── layout/                # Responsive navigation & footer
│   ├── menu/                  # Dish cards, categories, dietary filters
│   ├── reservations/          # Table booking interactive forms
│   └── ui/                    # Reusable atomic design primitives (Buttons, Modals, Badges)
├── config/                    # Site metadata, limits, navigation, role constants
├── hooks/                     # Custom React hooks (cart store, notifications)
├── lib/
│   ├── auth/                  # Argon2id hashing, session token verification, RBAC guards
│   ├── db/                    # Prisma client singleton instance
│   ├── email/                 # Transactional email service
│   ├── rate-limit/            # Token-bucket rate limiter engine
│   ├── services/              # Encapsulated domain business logic (menu, orders, reviews)
│   └── validation/            # Zod validation schemas
├── prisma/
│   ├── migrations/            # Version-controlled SQL migration history
│   ├── schema.prisma          # Authoritative relational database schema
│   └── seed.ts                # Database seed script
├── public/
│   └── images/                # Culinary photography, brand assets & screenshots
├── scripts/                   # Operations & management scripts (admin bootstrap)
└── tests/                     # Unit, integration & Playwright E2E suites
```

---

## 🚀 Enterprise B2B SaaS, S2S M2M Gateway & Real-Time WebSockets (Implemented)

The platform includes a production-grade **Multi-Tenant Enterprise B2B SaaS layer**, **Machine-to-Machine S2S API Engine**, **Cryptographic Webhook Dispatcher**, and **Real-Time Kitchen Display System (KDS)**:

```mermaid
flowchart LR
    subgraph MultiTenant["🏢 Multi-Tenant SaaS Layer"]
        TenantRouting["Dynamic Subdomain & Tenant Resolver\n(lib/db/tenant.ts)"]
        TenantIsolation["Tenant-Isolated Relational Models\n(Tenant -> Dishes/Orders)"]
        AdminPortal["Developer Portal\n(/admin/developers)"]
    end

    subgraph S2S["🔌 S2S & M2M Gateway"]
        ApiKeyGuard["Hashed API Keys (sp_live_...)\nSHA-256 Constant-Time Guard"]
        B2BEndpoints["Versioned REST Endpoints\n(/api/v1/menu, /orders, /reservations)"]
        Webhooks["HMAC-SHA256 Dispatcher\n(X-Spice-Signature)"]
    end

    subgraph RealTime["⚡ Real-Time Infrastructure"]
        WebSocketHub["Centralized Real-Time Event Bus\n(lib/realtime/bus.ts)"]
        LiveKDS["Kitchen Display System (KDS)\n(/admin/kds board)"]
        StreamEndpoint["Authenticated Stream\n(/api/v1/realtime/kds)"]
    end

    TenantRouting --> TenantIsolation
    ApiKeyGuard --> B2BEndpoints
    B2BEndpoints --> Webhooks
    WebSocketHub --> LiveKDS
    WebSocketHub --> StreamEndpoint
```

### 1. Multi-Tenant Architecture & Data Isolation
- **Tenant Entity**: PostgreSQL `Tenant` model with isolated relational bindings on `Dish`, `Order`, `Reservation`, `Category`, `Admin`, `ApiKey`, and `WebhookSubscription`.
- **Tenant Resolution**: Intelligent fallback and auto-scoping (`lib/db/tenant.ts`) ensuring existing single-tenant routes function seamlessly while enabling multi-tenant scaling.

### 2. S2S (Server-to-Server) M2M Authentication & Partner APIs
- **Cryptographic API Key Management**: Scoped API keys (`sp_live_...`) stored exclusively as **SHA-256 hashes** and verified in constant time (`crypto.timingSafeEqual`) to prevent timing attacks.
- **Granular Permissions Scopes**: API keys are restricted by scopes (`orders:read`, `orders:write`, `menu:read`, `reservations:read`, `reservations:write`, `kds:stream`, `admin:all`).
- **Versioned B2B Endpoints**:
  - `GET /api/v1/menu`: Sync real-time categorized menu catalog with external POS or digital menu boards.
  - `POST /api/v1/orders`: Ingest external orders from POS hardware or third-party delivery aggregators (Toast, Swiggy, Zomato).
  - `GET /api/v1/orders/:id` & `PATCH /api/v1/orders/:id`: Query and advance order lifecycle states (`CONFIRMED` ➔ `PREPARING` ➔ `READY` ➔ `COMPLETED`).
  - `GET /api/v1/reservations` & `POST /api/v1/reservations`: Ingest partner and concierge bookings.

### 3. Bi-Directional Real-Time WebSockets & Kitchen Display System (KDS)
- **Centralized Event Bus**: Real-time pub/sub bus (`lib/realtime/bus.ts`) dispatching instant order updates across the platform.
- **Kitchen Display System (KDS)**: Dedicated full-screen kitchen monitor dashboard at [`/admin/kds`](/admin/kds) with live drag-and-drop/advance columns (`New Orders` ➔ `In Preparation` ➔ `Ready for Pass` ➔ `Completed`), audio chime triggers, and live elapsed timers with zero page reloads.
- **Real-Time Stream**: Authenticated SSE/WebSocket stream at `/api/v1/realtime/kds` supporting persistent hardware displays and kitchen tablets.

### 4. Enterprise Webhook Gateway
- **Cryptographic Signatures**: All outbound event payloads are signed using **HMAC-SHA256** headers (`X-Spice-Signature: t=timestamp,v1=hash`).
- **Delivery Audit Trail**: Every webhook attempt, response code, and delivery status is tracked in the `WebhookDelivery` database audit table.
- **Partner Ingress**: Inbound webhook endpoint at `/api/v1/webhooks/ingress` with signature validation for delivery and payment lifecycle events.

---

## 📄 License & Attribution

Distributed under the **MIT License**. See `LICENSE` for more information.

Developed with precision and passion for modern web engineering. Feel free to use this project as a demonstration of high-performance, full-stack Next.js architecture.
