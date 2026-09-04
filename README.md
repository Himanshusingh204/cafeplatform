<div align="center">

# 🌿 Spice & Saffron
### Artisanal Indian Fine Dining & Full-Stack Café Platform
*Where the centuries-old heritage of Indian slow cooking meets modern, resilient software engineering.*

<br />

[![Next.js](https://img.shields.io/badge/Next.js-16.3-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue?style=for-the-badge&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178c6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38bdf8?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![Express](https://img.shields.io/badge/Express-Backend_API_(Port_4000)-404040?style=for-the-badge&logo=express)](https://expressjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-v7-2D3748?style=for-the-badge&logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18-336791?style=for-the-badge&logo=postgresql)](https://www.postgresql.org/)
[![Security](https://img.shields.io/badge/Security-Zero_Trust_%7C_Argon2id-brightgreen?style=for-the-badge&logo=shield)](https://cheatsheetseries.owasp.org/)
[![Tests](https://img.shields.io/badge/Testing-115_Passed_%7C_Vitest-orange?style=for-the-badge&logo=vitest)](https://vitest.dev/)

<br />

<img src="public/images/screenshots/banner.jpg" alt="Spice & Saffron Showcase Banner" width="100%" style="border-radius: 14px; box-shadow: 0 24px 48px rgba(0,0,0,0.45); border: 1px solid rgba(255,255,255,0.1);" />

<br />

**[Our Story](#-the-heartbeat--our-culinary-story)** • **[Dual-Port Architecture](#-dual-port-system-architecture)** • **[Customer Experience](#-the-dining--customer-experience)** • **[Kitchen & Admin CMS](#-kitchen-display-system--admin-cms)** • **[Security & Privacy](#-zero-trust-security--data-privacy)** • **[Getting Started](#-getting-started)** • **[Testing & QA](#-testing--quality-assurance)** • **[API & B2B Gateway](#-enterprise-b2b-gateway--real-time-kds)**

</div>

---

## 📖 The Heartbeat & Our Culinary Story

**Spice & Saffron** began in Hauz Khas Village, New Delhi, founded on three uncompromising principles:
1. **Whole spices only**: Sun-dried cloves, green cardamom pods, and Kashmiri chillies slow-roasted on thick cast-iron tawas and hand-ground every single morning. Never artificial extracts, powders, or shortcuts.
2. **Cooked low and slow**: Signature black lentils (*Dal Makhani*) gently simmering for 16 hours over charcoal embers in heavy copper handis.
3. **Honest, heartfelt hospitality (*Atithi Devo Bhava*)**: Food prepared with the same integrity and warmth as a festive family meal.

This codebase is the digital manifestation of that same care. Just as great cuisine relies on clean, pure ingredients and unhurried preparation, our engineering stack pairs **React 19 Server Components** and a **decoupled Express REST engine** to deliver instant performance, rock-solid security, and effortless reliability.

---

## 🏛 Dual-Port System Architecture

The platform operates on a decoupled multi-port architecture engineered for high concurrency, zero bundle bloat, and enterprise B2B integration:

- **Frontend (Port 3000)**: Next.js 16 App Router powering customer-facing SSR/ISR pages, interactive reservation modules, cart drawer, and the Admin Control Panel.
- **Backend API (Port 4000)**: High-throughput standalone Express service handling public REST endpoints, S2S partner integrations, real-time Kitchen Display System (KDS) streams, and cryptographic webhook ingestion.

```mermaid
flowchart TD
    subgraph ClientLayer["🖥️ Customer & Staff Clients (Browser)"]
        PublicApp["Customer Storefront & Menu\n(http://localhost:3000)"]
        AdminApp["Admin Dashboard & KDS\n(http://localhost:3000/admin)"]
        AudioEngine["Web Audio Chimes & Live Tracker"]
        POSPartner["Third-Party POS / Aggregators\n(Swiggy, Zomato, Toast)"]
    end

    subgraph Port3000["🌐 Frontend Service (Port 3000 — Next.js 16)"]
        RSC["React 19 Server Components (SSR / ISR)"]
        ClientProxy["Type-Safe API Proxy (lib/api/client.ts)"]
        AdminActions["Role-Guarded Server Actions (RBAC)"]
        SessionStore["Encrypted HttpOnly Session Cookies"]
    end

    subgraph Port4000["⚙️ Standalone Backend API (Port 4000 — Express)"]
        CORS["Cross-Origin Gate (Access-Control-Allow-Origin: 3000)"]
        S2SGuard["S2S Auth Guard (SHA-256 Constant-Time Key Verifier)"]
        MenuRoute["/api/v1/menu (Catalog)"]
        CouponRoute["/api/v1/coupons/validate (Promos)"]
        OrdersRoute["/api/v1/orders (B2B CRUD)"]
        KDSSSE["/api/v1/realtime/kds (Server-Sent Events)"]
        WebhookRoute["/api/v1/webhooks/payment (HMAC Ingress)"]
    end

    subgraph DataLayer["🗄️ Persistence & Services"]
        PrismaORM["Prisma ORM 7 with PgDriver Adapter"]
        PostgresDB[(PostgreSQL 18 Database)]
        RealtimeBus["Tenant Event Pub/Sub Bus"]
        PaymentGateways["Razorpay & Stripe SDKs"]
    end

    PublicApp -->|HTTP / React SSR| Port3000
    AdminApp -->|HTTP / Server Actions| Port3000
    Port3000 -->|CORS fetch (credentials: include)| Port4000
    POSPartner -->|Bearer sp_live_...| Port4000

    CORS --> S2SGuard
    S2SGuard --> MenuRoute
    S2SGuard --> OrdersRoute
    S2SGuard --> CouponRoute
    S2SGuard --> KDSSSE
    S2SGuard --> WebhookRoute

    KDSSSE --> RealtimeBus
    OrdersRoute --> RealtimeBus
    WebhookRoute --> RealtimeBus
    WebhookRoute --> PaymentGateways

    MenuRoute --> PrismaORM
    OrdersRoute --> PrismaORM
    AdminActions --> PrismaORM
    PrismaORM --> PostgresDB
```

---

## ✨ The Dining & Customer Experience

### 1. Dynamic Sensory Menu & Dietary Guidance
Browse seasonal dishes with instant filtering by dietary requirements:
- **Dietary Icons**: Vegetarian (`isVegetarian`), Vegan (`isVegan`), Spicy (`isSpicy`), Nut-Free (`containsNuts`).
- **Live Cart & Price Calculations**: Authoritative server-side price validation prevents tampering.
- **Dynamic Promo Codes**: Automatic coupon evaluation (`WELCOME50`, `TASTEOFDELHI`) with minimum order requirements.

### 2. Table Reservation Engine
- **Instant Booking**: Real-time slot availability, table assignment, and guest count management.
- **Reference Tracking**: Generates unique alphanumeric booking codes with live lookup capabilities.
- **Thoughtful Follow-up**: Automated email notifications and reminders via Resend API.

### 3. Multi-Gateway FinTech & Live Order Tracker
- **Payment Flexibility**: Native integration with **Razorpay**, **Stripe**, and **Pay at Pickup / Cash on Delivery**.
- **Idempotent Webhooks**: Cryptographically signed webhook listeners update order statuses and trigger kitchen tickets automatically.
- **Live 4-Stage Tracker**: Real-time visual progress (`Confirmed` ➔ `In Preparation` ➔ `Ready` ➔ `Completed`) with soothing Web Audio status chimes.

---

## 🍳 Kitchen Display System & Admin CMS

### 1. Real-Time Kitchen Display System (KDS)
Located at `/admin/kds`, this dashboard empowers culinary staff with:
- **Live Ticket Board**: New orders appear instantaneously via Server-Sent Events (SSE) with zero page refreshes.
- **Status Advancement**: Drag-and-drop or single-click ticket progression (`New` ➔ `Preparing` ➔ `Pass Ready` ➔ `Fulfilled`).
- **Elapsed Timers**: Color-coded urgency alerts to ensure tandoor items reach the pass at their prime temperature.

### 2. Role-Based Admin Control Panel
Three-tier permission hierarchy:
- **`SUPER_ADMIN`**: Full platform management, tenant configuration, API key generation, user provisioning, and audit log analysis.
- **`ADMIN`**: Daily operations, menu prices, dish availability toggles, coupon management, and reservation handling.
- **`EDITOR`**: Content updates, culinary story updates, and customer review moderation.

---

## 🛡️ Zero-Trust Security & Data Privacy

We treat customer trust and data privacy as foundational:

| Security Vector | Implementation Detail | Guarantee |
| :--- | :--- | :--- |
| **Password Protection** | **Argon2id** (memory-hard algorithm with unique salts) | Fully resilient against GPU/ASIC brute-force and dictionary attacks. |
| **Session Architecture** | 256-bit cryptographically secure tokens (`crypto.randomBytes`) | Stored in PostgreSQL as **SHA-256 hashes**. Cookies flagged `HttpOnly`, `Secure`, `SameSite=Lax`. |
| **Machine-to-Machine (S2S)** | Scoped API Keys (`sp_live_...`) | Constant-time buffer comparison (`crypto.timingSafeEqual`) prevents side-channel timing leaks. |
| **Payment Ingress** | HMAC-SHA256 signature verification | Prevents counterfeit webhook payloads and replay attacks. |
| **Data Boundary** | Parameterized Prisma ORM queries & Zod runtime validation | Prevents SQL injection, mass-assignment, and malformed inputs. |
| **Confidentiality** | Strict `.gitignore` enforcement for `.env*` & private credentials | Zero accidental secrets leakage. `AI_CONTEXT.md` ignored to protect architecture snapshots. |

---

## 🗄️ Relational Domain Model

Designed for strict referential integrity and multi-tenant scaling:

```mermaid
erDiagram
    Tenant ||--o{ Category : "owns"
    Tenant ||--o{ Dish : "serves"
    Tenant ||--o{ Order : "processes"
    Tenant ||--o{ Reservation : "hosts"
    Tenant ||--o{ ApiKey : "issues"
    Tenant ||--o{ Admin : "employs"

    Category ||--o{ Dish : "contains"
    Dish ||--o{ OrderItem : "ordered in"
    Order ||--o{ OrderItem : "contains"
    Admin ||--o{ Session : "authenticates"
    Admin ||--o{ ActivityLog : "records"

    Tenant {
        uuid id PK
        string slug UK
        string name
        boolean isActive
    }

    Dish {
        uuid id PK
        uuid categoryId FK
        string name
        string slug UK
        decimal price
        boolean isAvailable
        boolean isVegetarian
        boolean isVegan
        boolean isSpicy
    }

    Order {
        uuid id PK
        string orderNumber UK
        string customerName
        string customerEmail
        decimal totalAmount
        string orderStatus
        string paymentStatus
    }

    Reservation {
        uuid id PK
        string referenceCode UK
        string customerName
        datetime reservationDate
        string timeSlot
        int guestCount
        string status
    }
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: `v20.x` or higher
- **PostgreSQL**: `v14.x` or higher
- **npm** or **pnpm**

### 2. Installation
```bash
git clone https://github.com/your-username/spice-and-saffron.git
cd spice-and-saffron
npm install
```

### 3. Environment Configuration
Copy the template configuration:
```bash
cp .env.example .env.local
```
Configure your credentials in `.env.local`:
```env
# Database Connection
DATABASE_URL="postgresql://postgres:password@localhost:5432/indian_cafe?schema=public"

# Auth Session Secret (Generate via: openssl rand -base64 32)
AUTH_SECRET="your-32-character-random-secret-key-here"

# Dual-Port Decoupled URLs
APP_URL="http://localhost:3000"
API_PORT="4000"
NEXT_PUBLIC_API_URL="http://localhost:4000"

# Optional FinTech & Transactional Email
RAZORPAY_KEY_ID=""
RAZORPAY_KEY_SECRET=""
STRIPE_SECRET_KEY=""
RESEND_API_KEY=""
```

### 4. Database Initialization & Seed
```bash
# Apply migrations to PostgreSQL
npx prisma migrate deploy

# Seed baseline restaurant settings & culinary catalog
npm run db:seed
```
*(Tip: Set `SEED_DEMO_DATA="true"` in `.env.local` to seed complete demo dishes, categories, and reviews).*

### 5. Create Admin Account
```bash
ADMIN_EMAIL="admin@spiceandsaffron.in" ADMIN_PASSWORD="YourSecurePassword123!" npm run create-admin
```

### 6. Run Both Services Concurrently
```bash
npm run dev:all
```
- **Customer Storefront & Admin CMS**: [http://localhost:3000](http://localhost:3000)
- **Standalone Backend REST API**: [http://localhost:4000](http://localhost:4000)
- **API Health Check**: [http://localhost:4000/health](http://localhost:4000/health)

---

## 🧪 Testing & Quality Assurance

Our build pipeline enforces strict quality gates before any code merges:

```bash
# 1. End-to-end type safety verification
npm run typecheck

# 2. Strict ESLint standard compliance
npm run lint

# 3. Unit, integration & security test suites (Vitest)
npm test

# 4. Multi-browser End-to-End automation (Playwright)
npm run test:e2e
```

**Quality Status**:
- **Vitest**: 115 passing tests across 20 test suites (100% pass rate).
- **TypeScript**: 0 compiler errors (`tsc --noEmit`).
- **ESLint**: 0 warnings, 0 errors.
- **Lighthouse**: 100/100 Accessibility, 100/100 Best Practices, 100/100 SEO.

---

## 🔌 Enterprise B2B Gateway & Real-Time KDS

For restaurant groups, food delivery aggregators (Zomato, Swiggy), and external POS hardware:

- **Public & B2B Menu**: `GET http://localhost:4000/api/v1/menu`
- **Order Ingress (S2S)**: `POST http://localhost:4000/api/v1/orders` *(Requires `Authorization: Bearer sp_live_...` with `orders:write` scope)*
- **Real-Time KDS Stream**: `GET http://localhost:4000/api/v1/realtime/kds` *(Server-Sent Events streaming live kitchen tickets)*
- **Payment Webhook**: `POST http://localhost:4000/api/v1/webhooks/payment` *(HMAC-SHA256 verified)*

---

## 📚 Machine-Readable Context & File Index

To keep developer onboarding seamless and eliminate redundant AI context scans:
- **[`FILE_STRUCTURE.md`](./FILE_STRUCTURE.md)**: Exhaustive directory tree, architectural layer definitions, and coding conventions.
- **`AI_CONTEXT.md`**: Machine-readable index of all Prisma models, API routes, service functions, and security layers (stored locally and gitignored to preserve privacy).
- **[`HANDOFF.md`](./HANDOFF.md)**: Comprehensive production release runbook, environment checklist, and operational procedures.

---

## 📜 License & Acknowledgements

This project is licensed under the **MIT License**.

*Built with passion for great food and resilient software architecture.*
