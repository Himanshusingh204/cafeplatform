# SEO & Performance Plan

| Field | Value |
| :--- | :--- |
| **Project** | Spice & Saffron — multi-tenant Indian café / restaurant platform |
| **Owner** | Himanshu · [github.com/Himanshusingh204](https://github.com/Himanshusingh204) · himanshuyt21361@gmail.com |
| **Licence** | Proprietary — personal use only. © 2026 Himanshu. |
| **Status** | Planning · Phase 6 (SEO & Performance). Targets defined, enforcement not yet wired. |
| **Last updated** | 2026-10-15 |
| **Stack under analysis** | Next.js 16.3.1 (App Router, RSC, ISR) · React 19.2.8 · TypeScript strict · Tailwind CSS v4 · `next/font` (Geist + Marcellus, self-hosted) · `next/image` (AVIF + WebP) · framer-motion ^13.1.1 · lucide-react ^1.33.0 · Prisma 7 · Vercel target |

> **Reading note.** Every number in the "current" columns is measured from the
> repository (file sizes on disk, code in `app/`, `config/`, `next.config.ts`).
> Every number in a column labelled *est.* / *projected* is an **estimate**, not a
> measurement, and is labelled as such at the point of use. Nothing in this
> document should be quoted as a measured post-optimisation result until it has
> been re-measured by Lighthouse CI (see §7).

---

## Table of contents

1. [Executive summary](#1-executive-summary)
2. [Current state](#2-current-state)
3. [Performance & SEO budget](#3-performance--seo-budget)
4. [Performance plan](#4-performance-plan)
   - 4.1 [Image pipeline](#41-workstream-a--image-pipeline)
   - 4.2 [Fonts](#42-workstream-b--fonts)
   - 4.3 [JavaScript budget](#43-workstream-c--javascript-budget)
   - 4.4 [Delivery & caching](#44-workstream-d--delivery--caching)
   - 4.5 [Rendering strategy](#45-workstream-e--rendering-strategy)
   - 4.6 [Core Web Vitals measurement methodology](#46-workstream-f--core-web-vitals-measurement-methodology)
5. [Technical SEO plan](#5-technical-seo-plan)
   - 5.1 [Metadata completeness per route](#51-metadata-completeness-checklist-per-route)
   - 5.2 [Canonicals & the multi-tenant host hazard](#52-alternatescanonical--the-multi-tenant-host-hazard)
   - 5.3 [Open Graph images](#53-opengraph-image-and-per-route-og-images)
   - 5.4 [Structured data](#54-structured-data)
   - 5.5 [sitemap.ts fixes](#55-sitemapts-fixes)
   - 5.6 [robots.ts review](#56-robotsts-review)
   - 5.7 [Web manifest, icons, theme-colour, viewport](#57-web-manifest-icons-theme-colour-viewport)
   - 5.8 [Accessibility as an SEO/quality concern](#58-accessibility-as-an-seoquality-concern)
   - 5.9 [Internationalisation note](#59-internationalisation-note)
6. [Measurement & enforcement](#6-measurement--enforcement)
7. [Before/after projections](#7-beforeafter-projections)
8. [Prioritised action list](#8-prioritised-action-list)
9. [Verification checklist](#9-verification-checklist)

**Related documents:** [Master Plan](./MASTER_PLAN.md) · [Audit](./AUDIT.md) ·
[Roadmap](./ROADMAP.md) · [Architecture](./ARCHITECTURE.md) ·
[Testing](./TESTING.md) · [Operations](./OPERATIONS.md) · [Security Policy](../SECURITY.md)

---

## 1. Executive summary

**The single highest-leverage action in this plan is an image pipeline.** The
home page's LCP element is `public/images/hero/hero-dining.jpg`, which weighs
**951 KB** on disk — verified. A 951 KB hero image, served over a typical mobile
4G connection (~9 Mbps effective, ~1.6 MB/s realistic throughput once TLS, DNS,
TTFB and contention are accounted for), consumes roughly **0.6–0.9 s of pure
download time before decode**, and substantially more when the device must
decode and paint a large JPEG. On top of a realistic mobile TTFB of 150–400 ms
this makes **a Lighthouse Performance score of 100 on mobile mathematically
impossible** — the LCP budget is already spent on bytes that carry no
information a 1080-wide AVIF could not carry.

Everything else in this document — canonicals, JSON-LD, caching headers, JS
budget — is real work and worth doing, but it is **second-order** to the image
weight. Fix the images first; the other workstreams compound on top.

### Headline numbers (measured, then estimated)

| Metric | Current (measured) | After image pipeline (**estimated**) | Basis |
| :--- | :--- | :--- | :--- |
| Home LCP image weight | **951 KB** (`hero-dining.jpg`) | **≈ 65 KB** served at 1080w AVIF | Estimate, §7 |
| Heaviest shipped asset | **2 862 KB** (`screenshots/05-gallery.png`) | Moved out of shipped bundle, or ≈ 130 KB AVIF @1080 | Estimate, §7 |
| Assets ≥ 900 KB in `public/images/` | **12+** | 0 | Measured inventory |
| Home page total transfer (est.) | > 3 MB | **< 1.0 MB** (budget) | Estimate |
| Lighthouse Performance (mobile) | Not yet measured in CI | ≥ 95, targeting 100 | Budget |
| Est. byte reduction per photo asset | — | **≥ 90 %** at mobile-served widths | Estimate |

### Why 100 is currently unreachable (plainly)

Lighthouse's mobile Performance score is dominated by LCP, TBT and CLS. LCP for
an image hero is `TTFB + resource load delay + resource load time + element
render delay`. With the hero at 951 KB:

- Resource load time alone is large; on a throttled mobile profile Lighthouse
  applies (~1.6 Mbps down, 150 ms RTT) the transfer is measured in **seconds**.
- No amount of code-splitting, caching or font tuning reclaims those seconds,
  because the bottleneck is a single unoptimised payload.

Converting the hero to AVIF at the width actually needed and preloading it
removes the bottleneck. That is why the image pipeline is item #1 and the rest
is sequenced after it.

### What "done" looks like for Phase 6

| # | Outcome |
| :-- | :--- |
| 1 | No shipped image exceeds 200 KB; the LCP image is preloaded and ≤ 100 KB at mobile widths. |
| 2 | Every public indexable route has a title, description, canonical and OG image. |
| 3 | JSON-LD is generated from `config/site.ts` + the database, not a hardcoded literal. |
| 4 | `sitemap.xml` lists exactly the indexable routes with deterministic `lastModified`. |
| 5 | Lighthouse CI asserts the §3 budget on every PR and fails the build on regression. |

---

## 2. Current state

### 2.1 What already exists

| Area | Present? | Evidence |
| :--- | :---: | :--- |
| `metadataBase` | ✅ | `app/layout.tsx`, derived from `process.env.APP_URL` (default `http://localhost:3000`) |
| Title default + template | ✅ | `app/layout.tsx` + `config/seo.ts` (`%s \| <site name>`) |
| Description metadata | ✅ | `config/seo.ts` (from `site.description`) |
| Keywords metadata | ✅ | `config/seo.ts` |
| Open Graph | ✅ | `app/layout.tsx` spreads `seo.openGraph` and adds title/description |
| Twitter card | ✅ | `config/seo.ts` (`summary_large_image`) |
| `lang` attribute | ✅ | `<html lang="en">` in `app/layout.tsx` |
| JSON-LD | ⚠️ Partial | Hardcoded `Restaurant` object at `app/layout.tsx:43–76` |
| `robots.ts` | ✅ | Allows `/`, disallows `/admin` + `/api`, sitemap pointer |
| `sitemap.ts` | ⚠️ Partial | Static routes + dynamic dishes; **omits** several public routes |
| Security headers | ✅ | `next.config.ts` — CSP, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, HSTS on `/:path*` |
| `poweredByHeader: false` | ✅ | `next.config.ts` |
| `next/font` self-hosting | ✅ | Geist + Marcellus via `next/font` |
| `next/image` formats | ✅ | `formats: ["image/avif","image/webp"]` |
| `next/image` size ladders | ✅ | `deviceSizes: [640,750,828,1080,1200,1920]`, `imageSizes: [16,32,48,64,96,128,256,384]` |
| ISR on public pages | ✅ | Revalidate 5m / Expire 1y reported in build output |
| `favicon.ico` | ✅ | `app/favicon.ico`, referenced via `icons.icon` |

### 2.2 What is missing or wrong

| # | Gap | Impact | Severity |
| :-- | :--- | :--- | :--- |
| G1 | **951 KB LCP image**; 12+ assets ≥ 900 KB shipped from `public/images/` | Destroys LCP; makes Perf 100 impossible | **Critical** |
| G2 | Oversized PNG screenshots in the shipped bundle (`05-gallery.png` = 2 862 KB) | Page weight; crawl budget waste | Critical |
| G3 | No `alternates.canonical` anywhere | Duplicate-content risk; no self-canonical signal | High |
| G4 | Hardcoded `Restaurant` JSON-LD duplicating `config/site.ts` | Two sources of truth → drift; wrong data on tenant sites | High |
| G5 | No `opengraph-image` route | Every share renders a generic/absent preview | High |
| G6 | `sitemap.ts` omits `/reservations`, `/loyalty`, `/waitlist`; uses `new Date()` | Non-deterministic cache-busting; missing discoverable routes | High |
| G7 | No web manifest, no `theme-color`, no `viewport` export | No install metadata; weaker mobile signalling | Medium |
| G8 | framer-motion v13 in the initial storefront path (via `components/ui/motion.tsx`, `components/ui/reveal.tsx`) | JS budget / INP / TBT risk | Medium |
| G9 | `/menu/[slug]` fully dynamic although dish content is cacheable | Slow TTFB on the highest-value SEO page family | Medium |
| G10 | No `robots` metadata field (`metadata.robots`) for `noindex` per route | Checkout/order pages could be indexed | Medium |
| G11 | `public/images/brand/` is **empty**; inline SVG logo only in `components/brand/logo.tsx` | No crawlable, cacheable brand image for OG/schema | Low |
| G12 | No JSON-LD for `Menu`, `BreadcrumbList`, `FAQPage`, `Product` | Missed rich-result eligibility | Medium |
| G13 | `APP_URL` is a single hardcoded base; multi-tenant custom domains have no per-host canonical story | Multi-tenant canonical hazard | High |
| G14 | ~~`@vercel/blob` not installed; upload route falls back to base64 `data:` URLs~~ **Resolved 2026-10-15** (`lib/storage/` S3-compatible driver) | Uploads no longer bloat the DB (see [MASTER_PLAN §16 R4](./MASTER_PLAN.md)) | ✅ Closed (Phase 1) |
| G15 | No enforcement: no Lighthouse CI, no budget assertion | Regressions land silently | Medium |

### 2.3 Rendering & caching as built (from build output)

| Route family | Strategy as built | Notes |
| :--- | :--- | :--- |
| Public pages (`/`, `/about`, `/menu`, `/gallery`, `/contact`, `/faq`, `/privacy`, `/terms`) | ISR, `Revalidate 5m`, `Expire 1y` | Content changes rarely; 5m is conservative |
| `/menu/[slug]` | **Dynamic** | Cacheable content served dynamically — waste |
| `/order/[id]` | **Dynamic** | Correct: per-order, private |
| `/admin/*` | Dynamic | Correct: private |
| `/api/*` | Dynamic | Correct: private |
| `/robots.txt`, `/sitemap.xml` | Static | Correct |

---

## 3. Performance & SEO budget

Enforced in CI from **Phase 5** (Lighthouse CI + a11y assertions) and owned by
**Phase 6**. A PR that breaches any row fails the build.

| Metric | Budget | Target | Scope | Enforcement |
| :--- | :--- | :--- | :--- | :--- |
| Lighthouse Performance | **≥ 95** | 100 | Mobile, throttled | Lighthouse CI `assert` |
| Lighthouse Accessibility | **100** | 100 | Mobile | Lighthouse CI + Playwright axe-core |
| Lighthouse Best Practices | **100** | 100 | Mobile | Lighthouse CI |
| Lighthouse SEO | **100** | 100 | Mobile | Lighthouse CI |
| LCP | **< 2.0 s** | < 1.5 s | Mobile 4G, lab | Lighthouse CI `assert` |
| CLS | **< 0.05** | < 0.02 | Mobile | Lighthouse CI + RUM |
| INP | **< 200 ms** | < 100 ms | Mobile, field | RUM (lab proxy: TBT < 200 ms) |
| TTFB | **< 200 ms** | < 100 ms | Cached HTML | Lighthouse CI + `curl -w` |
| First-load JS (public route) | **< 150 KB** gzip | < 120 KB | Home + `/menu/[slug]` | Bundle budget check |
| Any single image | **< 200 KB** | < 100 KB | All shipped images | `scripts/` size gate |
| Home page total transfer | **< 1.0 MB** | < 700 KB | Cold cache, mobile | Lighthouse CI |

**Rationale.** Perf ≥ 95 (not "P100") is the enforce threshold because mobile
lab variance is real; 100 is the *goal*, 95 is the *gate*. A11y/BP/SEO are gated
at a hard 100 because those categories are deterministic — a score below 100
means a concrete defect, not noise.

---

## 4. Performance plan

Ordered by impact. Each workstream states concrete steps and the expected effect
(all effects **estimated** until re-measured).

### 4.1 Workstream A — Image pipeline

**Highest ROI. Do this first.**

#### A.1 Audit

| Step | Detail |
| :-- | :--- |
| A.1.1 | Enumerate every file under `public/images/**` and record bytes. A one-off `sharp`-based script (sharp ^0.35.4 is already a dependency) writes `docs/assets-inventory.json`. |
| A.1.2 | Map each file to the route(s) that reference it. Confirm which is the LCP element per route (home = `hero/hero-dining.jpg`). |
| A.1.3 | Record intrinsic pixel dimensions vs. the largest width each is ever displayed at. Anything served wider than its slot is waste. |
| A.1.4 | Flag assets referenced only by docs/README (e.g. `screenshots/*.png`) so they can leave the shipped bundle. |

#### A.2 Convert to AVIF/WebP

`next/image` is already configured for `formats: ["image/avif","image/webp"]`,
so on-demand conversion already happens **for images routed through
`next/image`**. The gap is (a) originals that are gigantic on disk — the optimiser
still uploads/reads them and, more importantly, any asset used via CSS
`background-image` or a raw `<img>` bypasses the optimiser entirely; and (b) the
optimiser cache is cold in CI.

| Step | Detail |
| :-- | :--- |
| A.2.1 | Re-encode high-value photos to AVIF at source with `sharp` (quality ≈ 50 AVIF / ≈ 78 WebP) and keep a WebP fallback only where a raw `<img>` is unavoidable. |
| A.2.2 | Down-scale originals to the widest size actually served (see A.3). Storing an 4000px original to serve a 1080px slot is pure waste. |
| A.2.3 | Ensure **every** content image renders through `next/image`. Replace any CSS `background-image: url(...)` hero with an `<Image fill>` inside an aspect-ratio wrapper. |

#### A.3 Responsive variants & `sizes`

The configured ladders are already sensible:

```
deviceSizes: [640, 750, 828, 1080, 1200, 1920]
imageSizes:  [16, 32, 48, 64, 96, 128, 256, 384]
```

| Step | Detail |
| :-- | :--- |
| A.3.1 | Provide an explicit `sizes` on **every** `next/image` so the browser picks the smallest sufficient variant. Without `sizes`, Next assumes `100vw` and ships the largest candidate. |
| A.3.2 | Hero (full-bleed): `sizes="100vw"`. |
| A.3.3 | Two-up / three-up gallery grids: `sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"` (adjust to the real grid). |
| A.3.4 | Menu thumbnails in a list: fixed `sizes="96px"` (or the true slot width). |
| A.3.5 | Verify by inspecting the generated `srcset` in the DOM — a card that should load the 384 variant must not be offered the 1920 one. |

#### A.4 `priority` discipline & LCP preload

| Rule | Rationale |
| :--- | :--- |
| `priority` on **exactly one** image per route — the true LCP element (home hero). | Each `priority` image emits a `<link rel="preload">`; more than one competes with the critical path. |
| Everything below the fold: default lazy loading (`next/image` lazy-loads by default) or explicit `loading="lazy"`. | Preserves bandwidth and main-thread time for the hero. |
| Optional: an explicit `<link rel="preload" as="image" ... imagesrcset ...>` in the hero route's head for the exact LCP candidate. | Removes discovery delay when the hero is referenced from deep in the tree. |
| `fetchPriority="high"` on the hero `<Image>` in addition to `priority`. | Reinforces the preload hint. |

#### A.5 CLS protection

| Requirement | Detail |
| :--- | :--- |
| Every `<Image>` has either intrinsic `width`/`height` or `fill` **inside a wrapper with a fixed `aspect-ratio`** | Prevents reflow when the image resolves. |
| No absolutely-positioned images without a reserved box | The classic CLS source. |
| Reserve the hero box with CSS `aspect-ratio` matching the asset's true ratio | Ensures the layout is stable even before bytes arrive. |
| Fonts handled separately (§4.2) — `size-adjust` / fallback metrics | Font swap is the other CLS contributor. |

#### A.6 Remove oversized screenshots from the bundle

`public/images/screenshots/05-gallery.png` (**2 862 KB**), `01-home-hero.png`
(1 354 KB) and `04-about-story.png` (1 334 KB) are documentation-grade captures.
They must not ship in the web bundle.

| Option | When to choose | Effect |
| :--- | :--- | :--- |
| Move to `docs/assets/` (outside `public/`) | If only docs/README reference them | Removes ~5.5 MB of dead weight from the deploy |
| Re-encode to AVIF ≤ 150 KB and keep in `public/` | If genuinely used on a marketing page | Keeps parity with the image budget |
| Drop entirely | If unreferenced | Simplest |

#### A.7 CI image-size gate

A script (`scripts/check-image-budget.mjs`) walks `public/images/**`, fails if any
file exceeds 200 KB, and prints a sorted table. Wire into `npm run verify:prod`
and CI.

**Expected effect (estimated):** ≥ 90 % byte reduction per photo asset at
mobile-served widths; the home LCP image drops from 951 KB to an estimated
60–100 KB; total home transfer falls under the 1.0 MB budget. Exact figures in §7.

---

### 4.2 Workstream B — Fonts

`next/font` with Geist + Marcellus is already the right foundation (self-hosted,
no third-party origin, no FOUT from an external CDN).

| Step | Detail | Expected effect |
| :-- | :--- | :--- |
| B.1 | Subset aggressively — Latin only unless Marcellus display text needs more. Next's `subsets: ["latin"]` is the lever. | Fewer font bytes; faster text paint. |
| B.2 | `display: "swap"` on **both** faces (Marcellus already sets it; confirm Geist). | Text visible immediately; avoids invisible-text FOIT. |
| B.3 | Preload **only the critical face** (`preload: true` on the body face; consider `preload: false` on the display face if it is above-the-fold-but-not-critical). | Avoids preloading non-critical fonts ahead of the hero. |
| B.4 | Tune fallback metrics — Next exposes `adjustFontFallback`; pair it with a metric-compatible fallback stack so the swap does not shift layout. | Removes the font-swap CLS contribution; protects the CLS < 0.05 budget. |
| B.5 | Use `variable` fonts to collapse multiple weights into one file where a design allows. | Fewer requests. |

**Expected effect (estimated):** eliminates font-swap CLS; keeps font cost inside
the 150 KB first-load JS budget (fonts are not JS, but they share the critical
path).

---

### 4.3 Workstream C — JavaScript budget

framer-motion v13 is a real dependency, used through `components/ui/motion.tsx`
and `components/ui/reveal.tsx`, and is the primary TBT/INP risk.

| Step | Detail | Expected effect |
| :-- | :--- | :--- |
| C.1 | Classify every motion usage. Trivial reveals (fade/translate on scroll-into-view) are replaceable with a few lines of CSS + an `IntersectionObserver`. | Removes framer-motion from the storefront critical path. |
| C.2 | For non-trivial motion, import from `framer-motion` sub-paths (e.g. `motion/react`) to enable tree-shaking and avoid the full bundle. | Smaller client chunk. |
| C.3 | Wrap every animation in `@media (prefers-reduced-motion: reduce)` (or `useReducedMotion`) with a no-op fallback. | Accessibility + avoids work on reduced-motion devices. |
| C.4 | **Lazy-load heavy client components** the storefront does not need on load: cart drawer, checkout modal, dish modifier modal, KDS board. Each behind `next/dynamic({ ssr: false })` or a route boundary. | Keeps them out of first-load JS. |
| C.5 | Verify with the bundle analyzer (`@next/bundle-analyzer`) that a public route's client chunks do **not** contain `Kanban`/KDS, checkout, or cart-drawer module names. | Objective proof of code-split boundaries. |
| C.6 | Confirm lucide-react imports are per-icon (`import { MapPin } from "lucide-react"`), not the barrel (`import * as Icons`). | Avoids shipping the whole icon set. |

**How to measure:**

| Tool | What it answers |
| :--- | :--- |
| `@next/bundle-analyzer` (`ANALYZE=true next build`) | Module-level attribution: which chunk, which KB. |
| `next build` route table | First Load JS per route (compare against the 150 KB budget). |
| Lighthouse "Reduce unused JavaScript" audit | Confirms lazy-loaded chunks are actually deferred. |
| DevTools Coverage panel | Unused-bytes % on the initial load. |
| Web Vitals RUM (§4.6) | Field INP/Long Tasks. |

**What to check specifically:** cart drawer, checkout modal, dish modifier modal
and KDS board **must not** appear in the initial storefront JS. If any does, the
code-split boundary is wrong.

---

### 4.4 Workstream D — Delivery & caching

| Target | Header | Notes |
| :--- | :--- | :--- |
| Hashed build assets (`/_next/static/**`) | `Cache-Control: public, max-age=31536000, immutable` | Safe: filenames are content-hashed. |
| `next/image` optimiser output | `Cache-Control: public, max-age=31536000, immutable` (Next default) | Confirm not overridden by the catch-all `next.config.ts` headers block. |
| ISR HTML | `Cache-Control: public, s-maxage=300, stale-while-revalidate=86400` (align with the 5m revalidate) | Serve stale instantly while revalidating at the edge. |
| Private HTML (`/checkout`, `/order/[id]`, `/admin/*`) | `Cache-Control: private, no-store` | Never cache PII. |
| Public API reads (menu, availability) | `Cache-Control: public, s-maxage=60, stale-while-revalidate=300` | Cheap, correct-ish freshness. |
| Mutating API routes | `Cache-Control: no-store` | Correctness. |
| Compression | Brotli at the edge; gzip fallback | Vercel handles Brotli automatically — verify no middleware strips it. |
| Edge/CDN | Static assets + optimised images served from the CDN POP; ISR HTML cached at the edge | Minimises TTFB, the first term in LCP. |

**Note on the current `next.config.ts` headers block:** it applies security headers
to `/:path*`, which is correct, but a *cache* header must not clobber the
immutable caching of `/_next/static`. Keep caching rules scoped to the route
families above and leave static assets to Vercel's defaults.

---

### 4.5 Workstream E — Rendering strategy

Recommendation per route. "Dynamic" means per-request rendering; "ISR" means
static with background revalidation.

| Route | Recommended | Revalidate | Rationale |
| :--- | :--- | :--- | :--- |
| `/` | **ISR** | 300 s | Rarely changes; cheap to serve statically. |
| `/about` | **ISR** | 3600 s | Near-static editorial content. |
| `/menu` | **ISR** | 300 s | Dish list changes on CMS mutation; 5m is fine. |
| `/menu/[slug]` | **ISR + tag revalidation** | 3600 s, `revalidateTag('dish:<slug>')` on write | **Change from today's dynamic.** Dish content is cacheable; revalidate on CMS mutation instead of per request. This is the highest-value SEO page family. |
| `/gallery` | **ISR** | 3600 s | Image set changes rarely. |
| `/contact` | **ISR** | 3600 s | Static. |
| `/faq` | **ISR** | 3600 s | Static; also JSON-LD source. |
| `/privacy` | **Static** | — | Legal text; changes on policy revision (build-time). |
| `/terms` | **Static** | — | Same. |
| `/reservations` | **ISR** | 300 s | Form + availability hints; page shell is static. |
| `/loyalty` | **ISR** | 3600 s | Marketing shell; personal data loaded client-side. |
| `/waitlist` | **ISR** | 300 s | Static shell + client form. |
| `/checkout` | **Dynamic** (client shell) | — | Private, cart-dependent. `noindex`. |
| `/order/[id]` | **Dynamic** | — | Private per-order tracker. `noindex`. |
| `/admin/*` | **Dynamic** | — | Private. `noindex` + disallowed. |
| `/api/*` | **Dynamic** | — | Handlers; per-route cache headers as in §4.4. |

**Converting `/menu/[slug]` to ISR:** wrap the data read in a cache tag

```ts
// lib/db/prisma.ts consumer
const dish = await unstable_cache(
  () => db.dish.findUnique({ where: { slug } }),
  ["dish", slug],
  { tags: [`dish:${slug}`, "dish:list"], revalidate: 3600 },
)();
```

and call `revalidateTag(\`dish:${slug}\`)` (plus `revalidateTag("dish:list")`)
in the admin mutation path. This gives static-speed TTFB with correct freshness
and removes the DB round-trip from the SEO-critical path.

---

### 4.6 Workstream F — Core Web Vitals measurement methodology

Both lab and field are required; neither is sufficient alone.

| Dimension | Lab (Lighthouse CI) | Field (RUM / CrUX) |
| :--- | :--- | :--- |
| What it measures | Synthetic, reproducible, throttled | Real users, real devices, real networks |
| Strength | Deterministic; perfect as a **regression gate** | Truth about actual experience |
| Weakness | Does not reflect your traffic mix | Noisy, low-volume pages get no data |
| Verdict | **Enforce** the §3 budget on every PR | **Monitor** to validate the lab model |

**Why both:** lab catches regressions before they ship (deterministic pass/fail);
field catches the regressions lab misses (device diversity, cache state, geography)
and validates that lab gains translate to real users. CrUX only surfaces popular
URLs, so the RUM collector (§6.3) fills the gaps.

---

## 5. Technical SEO plan

### 5.1 Metadata completeness checklist per route

Every indexable route needs: **title**, **description**, **canonical**, **OG
image**, **Twitter card**. Private routes need `robots: { index: false }` and are
excluded from the sitemap.

| Route | Index? | Title | Description | Canonical | OG image | Twitter card | Status today |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| `/` | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | Missing canonical + OG image |
| `/about` | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | Missing canonical + OG image |
| `/menu` | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | Missing canonical + OG image |
| `/menu/[slug]` | ✅ | ✅ (per dish) | ✅ | ❌ | ❌ | ✅ | Missing canonical + OG image; dish schema |
| `/gallery` | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | Missing canonical + OG image |
| `/contact` | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | Missing canonical; `LocalBusiness` schema |
| `/faq` | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | Missing canonical; `FAQPage` schema |
| `/privacy` | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | Missing canonical |
| `/terms` | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | Missing canonical |
| `/reservations` | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | **Absent from sitemap**; missing canonical |
| `/loyalty` | ⚠️ | ✅ | ✅ | ❌ | ❌ | ✅ | Index **only if** the page is public marketing; `noindex` if it requires auth |
| `/waitlist` | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | **Absent from sitemap**; missing canonical |
| `/checkout` | ❌ | ✅ | — | — | — | — | **Must add `robots: { index: false }`** |
| `/order/[id]` | ❌ | ✅ | — | — | — | — | **Must add `robots: { index: false }`** |
| `/admin/*` | ❌ | — | — | — | — | — | Disallowed in `robots.txt`; add `noindex` header too |

**Implementation shape (per route):**

```ts
export const metadata: Metadata = {
  title: "Menu",
  description: "Hand-crafted curries, tandoori specialities and desserts…",
  alternates: { canonical: "/menu" }, // resolves against metadataBase
  openGraph: { title: "Menu", description: "…", images: ["/opengraph-image"] },
  twitter: { card: "summary_large_image" },
};
```

And for private routes:

```ts
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};
```

---

### 5.2 `alternates.canonical` & the multi-tenant host hazard

**Today:** `metadataBase` comes from a single `process.env.APP_URL` (default
`http://localhost:3000`). There is no `alternates.canonical` on any route.

**The hazard:** this is a **multi-tenant** platform. If tenant `A` is served on
`spiceandsaffron.in` and tenant `B` on `cafeb.in`, but `metadataBase` is one
hardcoded `APP_URL`, then tenant `B`'s pages will emit a canonical pointing at
tenant `A`'s host — a direct, self-inflicted de-indexing. The same bug affects
`sitemap.xml` and `robots.txt`, which both hardcode `APP_URL`.

**Required design:**

| Rule | Detail |
| :--- | :--- |
| Resolve the host per request | Read the resolved tenant host (from the proxy/tenant resolver and `Host`/`x-forwarded-host`), not a global constant. |
| `metadataBase` follows the resolved host | Build it from the tenant's primary domain at request time. |
| Canonicals follow the same host | `alternates.canonical` is relative (`/menu`); Next resolves it against the tenant-correct `metadataBase`. Never hardcode an absolute URL in a canonical. |
| `sitemap.ts` uses the resolved host | The static `/sitemap.xml` cannot be per-tenant unless made dynamic or split per tenant — flag as a design decision. |
| `robots.ts` uses the resolved host | Same. |
| Cross-tenant safety test | A test asserting tenant `B`'s rendered `<link rel="canonical">` never contains tenant `A`'s host. |

> **Interim single-tenant note.** Until multi-tenant routing is live, a single
> `APP_URL` is acceptable, but the canonical must **still** be emitted (relative)
> so the signal exists the moment a second host appears. Treat the hardcoded
> `APP_URL` in `sitemap.ts`/`robots.ts` as a known limitation of Phase 6, resolved
> in Phase 9 (commercial readiness).

---

### 5.3 `opengraph-image` and per-route OG images

| Step | Detail |
| :-- | :--- |
| C.1 | Add `app/opengraph-image.tsx` using `ImageResponse` (1200×630) with the site name, tagline and brand colours drawn from `config/site.ts`. This becomes the default OG image for the whole app. |
| C.2 | Add per-route `opengraph-image.tsx` where the message differs: `/menu/[slug]` (dish name + price), `/about`, `/faq`. |
| C.3 | Ensure `openGraph.images` and `twitter.images` point at the file-convention output (Next wires this automatically when the convention file exists; explicit paths otherwise). |
| C.4 | Pass `size` and `contentType` so crawlers get the right hints. |
| C.5 | When `public/images/brand/` is populated (it is currently empty), consider a static brand card as the fallback to avoid per-request image generation cost. |

---

### 5.4 Structured data

**Replace** the hardcoded literal at `app/layout.tsx:43–76`. Generate from typed
config + DB so `config/site.ts` remains the single source of truth.

#### S1 — `Restaurant` / `LocalBusiness` (from config)

```ts
// lib/seo/jsonld.ts
import { site } from "@/config/site";

export function restaurantJsonLd(host: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: site.name,
    description: site.description,
    url: `https://${host}`,
    telephone: site.phone,
    email: site.email,
    servesCuisine: "Indian",
    priceRange: "₹₹",
    image: [
      `https://${host}/images/hero/hero-dining.jpg`,
    ],
    address: {
      "@type": "PostalAddress",
      streetAddress: "12 Café Lane, Hauz Khas",
      addressLocality: "New Delhi",
      postalCode: "110016",
      addressCountry: "IN",
    },
    geo: { "@type": "GeoCoordinates", latitude: 28.5494, longitude: 77.2001 },
    openingHoursSpecification: Object.entries(site.openingHours).map(
      ([day, hours]) => ({
        "@type": "OpeningHoursSpecification",
        dayOfWeek: day[0].toUpperCase() + day.slice(1),
        opens: "11:00",
        closes: "23:00", // derive from `hours` string, not hardcoded
      }),
    ),
    sameAs: [site.instagram, site.facebook],
    hasMenu: `https://${host}/menu`,
  };
}
```

> The `opens`/`closes` values must be **derived** from `site.openingHours`
> strings, not hardcoded — the current literal hardcodes `openingHours` strings
> that already differ from `config/site.ts` (Saturday/Sunday open at 09:00).

Add `aggregateRating` only when real, approved review data exists:

```jsonc
"aggregateRating": {
  "@type": "AggregateRating",
  "ratingValue": "4.7",
  "reviewCount": "182"
}
```

**Rule:** never emit `aggregateRating` from seeded/placeholder reviews. Google
penalises fabricated ratings. Source it from approved reviews only; omit the
property if there are none.

#### S2 — `Menu` / `MenuSection` / `MenuItem` (from DB)

```jsonc
{
  "@context": "https://schema.org",
  "@type": "Menu",
  "name": "Spice & Saffron Menu",
  "hasMenuSection": [
    {
      "@type": "MenuSection",
      "name": "Curries",
      "hasMenuItem": [
        {
          "@type": "MenuItem",
          "name": "Butter Chicken",
          "description": "Tandoor-kissed chicken in a silky tomato-butter gravy.",
          "offers": {
            "@type": "Offer",
            "price": "420",
            "priceCurrency": "INR"
          }
        }
      ]
    }
  ]
}
```

Generated by iterating dish categories and dishes from Prisma in `/menu`.

#### S3 — `Product` / `Offer` per dish (`/menu/[slug]`)

```jsonc
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Chicken Biryani",
  "image": ["https://{host}/images/menu/chicken-biryani.jpg"],
  "description": "…",
  "offers": {
    "@type": "Offer",
    "price": "480",
    "priceCurrency": "INR",
    "availability": "https://schema.org/InStock"
  }
}
```

#### S4 — `BreadcrumbList` (every nested route)

```jsonc
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://{host}/" },
    { "@type": "ListItem", "position": 2, "name": "Menu", "item": "https://{host}/menu" },
    { "@type": "ListItem", "position": 3, "name": "Chicken Biryani" }
  ]
}
```

#### S5 — `FAQPage` (`/faq`)

```jsonc
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Do you take reservations?",
      "acceptedAnswer": { "@type": "Answer", "text": "Yes — book online up to 30 days ahead." }
    }
  ]
}
```

**Validation:** every generator output must pass
[Google's Rich Results Test](https://search.google.com/test/rich-results) and the
Schema Markup Validator before merge. Inject via a single `<script
type="application/ld+json">` per type, or a `@graph` array to bundle them.

---

### 5.5 `sitemap.ts` fixes

| # | Fix | Detail |
| :-- | :--- | :--- |
| F1 | **Add missing public routes** | `/reservations`, `/loyalty` (if indexable), `/waitlist`. |
| F2 | **Exclude `noindex` routes** | `/checkout`, `/order/[id]`, `/admin/*` must never appear. |
| F3 | **Deterministic `lastModified`** | Replace the single `new Date()` with the newest real `updatedAt` across the content each route depends on (or per-route constants bumped on content change). `new Date()` changes on every build and defeats cache validation. |
| F4 | **Keep dish entries** | Already correct: `where: { isAvailable: true, deletedAt: null }`, `lastModified: dish.updatedAt`. |
| F5 | **Harden the DB fallback** | The current `try/catch` swallows DB failure and returns static entries. Keep it, but log a warning so a silent partial sitemap is observable. |
| F6 | **Resolve the host per tenant** | Replace `process.env.APP_URL` with the resolved tenant host (§5.2). |
| F7 | **hreflang** | Add `alternates.languages` **only if** a second locale is introduced (§5.9). Do not add it speculatively. |

**Target static route set (indexable only):**

```
/
/about
/menu
/gallery
/contact
/faq
/reservations
/loyalty      (conditionally)
/waitlist
/privacy
/terms
+ /menu/{slug} for every available, non-deleted dish
```

---

### 5.6 `robots.ts` review

| Check | Today | Verdict |
| :--- | :--- | :--- |
| `allow: "/"` | ✅ | Correct |
| `disallow: ["/admin", "/api"]` | ✅ | Correct — keep, and prefer trailing-wildcard form `/admin/` + `/api/` if the intent is "everything under". |
| `sitemap` pointer | ✅ | Correct; must follow the resolved tenant host (§5.2). |
| `noindex` for private pages | ❌ | **Add `robots: { index: false }` metadata** on `/checkout`, `/order/[id]`, `/admin/*` — `robots.txt` disallow alone does not prevent indexing of linked URLs. |
| Preview / non-prod behaviour | ❌ | **Add per-environment rules.** In preview/staging, disallow everything (`userAgent: "*", disallow: "/"`) so previews never compete with production. |
| `host` directive | — | Not needed; `sitemap` is sufficient. |

**Recommended shape:**

```ts
export default function robots(): MetadataRoute.Robots {
  const isProd = process.env.VERCEL_ENV === "production";
  const host = resolveTenantHost();
  return isProd
    ? {
        rules: [{ userAgent: "*", allow: "/", disallow: ["/admin/", "/api/"] }],
        sitemap: `https://${host}/sitemap.xml`,
      }
    : { rules: [{ userAgent: "*", disallow: "/" }] };
}
```

---

### 5.7 Web manifest, icons, theme-colour, viewport

| Asset | Where | Notes |
| :--- | :--- | :--- |
| Web manifest | `app/manifest.ts` (`MetadataRoute.Manifest`) | `name: site.name`, `short_name: "Spice & Saffron"`, `start_url: "/"`, `display: "standalone"`, `background_color` + `theme_color` from brand. |
| Icons | `app/icon.png`, `app/apple-icon.png`, plus `icons` entries in metadata | Next file conventions generate the `<link>` tags. |
| Favicon | `app/favicon.ico` | Already present. |
| `theme-color` | `viewport` export: `themeColor: [{ media: "(prefers-color-scheme: light)", color: "#…" }, …]` | Colours must come from the brand tokens, not invented values. |
| `viewport` export | `export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: ... }` | Replaces the deprecated per-metadata viewport fields. |

---

### 5.8 Accessibility as an SEO/quality concern

A11y is gated at 100 because it is deterministic and because it overlaps SEO
(crawlability, semantics, mobile usability).

| Concern | Rule | Verification |
| :--- | :--- | :--- |
| Heading hierarchy | One `<h1>` per page; no skipped levels (`h1 → h3`) | axe-core `heading-order` |
| Landmarks | `<header>`, `<nav>`, `<main>`, `<footer>` present and unique | axe-core `landmark-*` |
| Alt text discipline | Meaningful `alt` for content images; `alt=""` for **decorative** images | Manual + axe `image-alt` |
| Focus order | Logical DOM order; visible focus ring; no positive `tabindex` | Manual keyboard walk |
| Colour contrast | ≥ 4.5:1 body text, ≥ 3:1 large text/UI | axe `color-contrast` |
| Reduced motion | All animation respects `prefers-reduced-motion` | Manual + workstream C |
| Link text | Descriptive link text; no "click here" | Manual review |
| Form labels | Every input labelled | axe `label` |

---

### 5.9 Internationalisation note

| Aspect | Today | If multi-locale is introduced (not a current requirement) |
| :--- | :--- | :--- |
| Locale | `en_IN` in OG | Add `alternates.languages` + hreflang |
| Currency | `INR` (`site.currency`) | Keep INR; expose per-locale formatting |
| Routing | Single locale | `app/[locale]/…` or middleware-driven locale routing |
| Canonical | Per host | Per host **and** locale |
| Sitemap | Single | Add hreflang alternates per URL |

No action now. Documented so the canonical/sitemap design does not paint itself
into a single-locale corner.

---

## 6. Measurement & enforcement

### 6.1 Local Lighthouse

```bash
# Production build, then audit
npm run build
npm run start &            # serves on :3000
npx lighthouse http://localhost:3000 --preset=desktop --view
npx lighthouse http://localhost:3000 --form-factor=mobile --throttling-method=simulate --view
```

Rules: always audit the **production build**, never `next dev`. Mobile is the
gating profile (§3).

### 6.2 Lighthouse CI (GitHub Action sketch)

```yaml
# .github/workflows/lighthouse.yml
name: Lighthouse CI
on: [pull_request]

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: .nvmrc, cache: npm }
      - run: npm ci
      - run: npm run build
      - name: Run Lighthouse CI
        run: |
          npm i -g @lhci/cli
          lhci autorun
        env:
          LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_GITHUB_APP_TOKEN }}
```

`lighthouserc.json` (budgets from §3):

```json
{
  "ci": {
    "collect": {
      "url": [
        "http://localhost:3000/",
        "http://localhost:3000/menu",
        "http://localhost:3000/menu/butter-chicken",
        "http://localhost:3000/about",
        "http://localhost:3000/contact"
      ],
      "numberOfRuns": 3,
      "startServerCommand": "npm run start"
    },
    "assert": {
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.95 }],
        "categories:accessibility": ["error", { "minScore": 1 }],
        "categories:best-practices": ["error", { "minScore": 1 }],
        "categories:seo": ["error", { "minScore": 1 }],
        "largest-contentful-paint": ["error", { "maxNumericValue": 2000 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.05 }],
        "total-blocking-time": ["error", { "maxNumericValue": 200 }],
        "resource-summary:script:size": ["error", { "maxNumericValue": 153600 }]
      }
    },
    "upload": { "target": "temporary-public-storage" }
  }
}
```

> The INP budget is asserted via TBT (< 200 ms) in the lab because Lighthouse does
> not emit INP from a single cold load; real INP is asserted in the field (§6.3).

### 6.3 Web Vitals RUM collector design

| Component | Detail |
| :--- | :--- |
| Collection | `useReportWebVitals` from `next/web-vitals` on a client boundary; capture `LCP`, `CLS`, `INP`, `TTFB`, `FCP`. |
| Transport | `navigator.sendBeacon("/api/vitals", blob)` — non-blocking, survives unload. |
| Payload | `{ name, value, id, rating, path, connection, deviceMemory, tenant }` — never PII. |
| Endpoint | `app/api/vitals/route.ts`; `Cache-Control: no-store`; rate-limited (Phase 4). |
| Storage | Append-only table or the log pipeline (Phase 7 observability); aggregate p75 per route. |
| Sampling | Sample a fraction on high-traffic pages to bound cost. |
| Alerting | p75 LCP > 2.5 s or p75 INP > 200 ms on any route → Phase 7 alert. |
| Cross-check | Compare RUM p75 against CrUX once volume exists. |

### 6.4 Accessibility assertions (Playwright + axe-core)

```ts
// tests/e2e/a11y.spec.ts
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const path of ["/", "/menu", "/about", "/contact", "/faq"]) {
  test(`a11y: ${path}`, async ({ page }) => {
    await page.goto(path);
    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(violations).toEqual([]);
  });
}
```

Add `@axe-core/playwright` as a devDependency; wire into the existing Playwright
setup (`npm run test:e2e`). Cross-reference [TESTING.md](./TESTING.md).

### 6.5 Image-byte gate

```
npm run check:images   # scripts/check-image-budget.mjs
# exits 1 if any file under public/images/** exceeds 200 KB
```

---

## 7. Before/after projections

> **All target sizes below are ESTIMATES, not measurements.** They assume AVIF
> quality ≈ 50 at the stated width with `sharp`, and a typical photographic
> subject. Actual results depend on image content and must be re-measured;
> the §9 checklist requires it.

### 7.1 Per-asset projections (estimates)

| Asset | Current (measured) | Est. AVIF @1920w | Est. AVIF @1080w | Est. saving @1080w | Technique |
| :--- | ---: | ---: | ---: | ---: | :--- |
| `screenshots/05-gallery.png` | **2 862 KB** | ~190 KB | ~130 KB | ~95 % | Move out of bundle, or AVIF + downscale |
| `screenshots/01-home-hero.png` | 1 354 KB | ~125 KB | ~85 KB | ~94 % | Move out of bundle (docs asset) |
| `screenshots/04-about-story.png` | 1 334 KB | ~122 KB | ~84 KB | ~94 % | Move out of bundle (docs asset) |
| `about/chef-tandoor.jpg` | 965 KB | ~96 KB | ~66 KB | ~93 % | AVIF + responsive variants |
| `gallery/tandoor-action.jpg` | 965 KB | ~96 KB | ~66 KB | ~93 % | AVIF + responsive variants |
| `placeholders/chef-placeholder.jpg` | 965 KB | ~96 KB | ~66 KB | ~93 % | AVIF + downscale |
| `gallery/biryani-handi.jpg` | 960 KB | ~95 KB | ~65 KB | ~93 % | AVIF + responsive variants |
| `placeholders/gallery-placeholder.jpg` | 960 KB | ~95 KB | ~65 KB | ~93 % | AVIF + downscale |
| `menu/chicken-biryani.jpg` | 960 KB | ~95 KB | ~65 KB | ~93 % | AVIF + responsive variants |
| **`hero/hero-dining.jpg` (LCP)** | **951 KB** | ~95 KB | **~65 KB** | **~93 %** | AVIF @1080 + `priority` + preload |
| `gallery/interior-01.jpg` | 951 KB | ~95 KB | ~65 KB | ~93 % | AVIF + responsive variants |
| `placeholders/hero-placeholder.jpg` | 951 KB | ~95 KB | ~65 KB | ~93 % | AVIF + downscale |

**Estimated aggregate:** the twelve assets above total **≈ 14.4 MB** today; at
mobile-served AVIF widths they total **≈ 0.9 MB** — an estimated **~94 %**
reduction. Every asset lands under the 200 KB single-image budget.

### 7.2 Route-level projections (estimates)

| Route | Est. transfer today | Est. transfer after | Est. LCP today | Est. LCP after | Primary lever |
| :--- | ---: | ---: | ---: | ---: | :--- |
| `/` | > 3.0 MB | < 1.0 MB | > 4 s (mobile) | < 2.0 s | Hero AVIF + preload + font CLS fix |
| `/menu` | > 2.5 MB | < 0.8 MB | > 3.5 s | < 2.0 s | Thumbnail AVIF + `sizes` |
| `/menu/[slug]` | > 1.0 MB | < 0.5 MB | > 3.0 s | < 1.8 s | ISR + dish image AVIF |
| `/gallery` | > 4.0 MB | < 0.9 MB | > 4 s | < 2.0 s | Lazy-load + AVIF grid |

### 7.3 Non-image projections (estimates)

| Item | Today | After | Technique |
| :--- | :--- | :--- | :--- |
| Storefront first-load JS | Not yet measured; framer-motion in path | < 150 KB gzip (budget) | CSS reveals + dynamic heavy components (workstream C) |
| CLS | Unmeasured; image + font swap risks | < 0.05 | `aspect-ratio` wrappers + `adjustFontFallback` |
| Cached TTFB | Unmeasured | < 200 ms | Edge cache + `stale-while-revalidate` |
| Lighthouse Perf (mobile) | Unmeasured (expected low due to LCP) | ≥ 95 → 100 | All of the above |

---

## 8. Prioritised action list

Ordered by impact ÷ effort. Phase = delivery phase from
[MASTER_PLAN §15](./MASTER_PLAN.md).

| # | Action | Impact | Effort | Phase | Depends on |
| :-- | :--- | :--- | :--- | :---: | :--- |
| 1 | Re-encode + downscale all `public/images/**` to AVIF; enforce < 200 KB | **Very high** | M | 6 | — |
| 2 | Add `priority` + preload to the home hero; `sizes` on every `<Image>` | **Very high** | S | 6 | 1 |
| 3 | Move `screenshots/*.png` out of the shipped bundle | **High** | S | 6 | — |
| 4 | `aspect-ratio` wrappers / intrinsic dimensions on all images (CLS) | **High** | S | 6 | — |
| 5 | `alternates.canonical` on every indexable route | **High** | S | 6 | — |
| 6 | Replace hardcoded JSON-LD with generators from `config/site.ts` + DB | **High** | M | 6 | — |
| 7 | Add `robots: { index: false }` to `/checkout`, `/order/[id]`, `/admin/*` | **High** | S | 6 | — |
| 8 | Fix `sitemap.ts`: add missing routes, deterministic `lastModified`, drop `noindex` | **High** | S | 6 | 7 |
| 9 | Convert `/menu/[slug]` to ISR with tag-based revalidation | **High** | M | 6 | Phase 2/3 cache |
| 10 | `opengraph-image` (+ per-route) | Medium | S | 6 | — |
| 11 | Trim framer-motion; CSS reveals; dynamic-import heavy client components | Medium | M | 6 | — |
| 12 | Font subsetting + fallback metrics + `preload` policy | Medium | S | 6 | — |
| 13 | Cache headers: immutable assets, SWR HTML, `no-store` private | Medium | S | 6 | — |
| 14 | `manifest.ts`, icons, `theme-color`, `viewport` export | Medium | S | 6 | — |
| 15 | Lighthouse CI + `assert` budgets in GitHub Actions | **High** | M | 5 | 1–14 |
| 16 | Playwright + axe-core a11y assertions | Medium | S | 5 | — |
| 17 | RUM web-vitals collector + endpoint | Medium | M | 6/7 | Phase 4 rate limit |
| 18 | Multi-tenant host resolution for `metadataBase`/canonical/sitemap/robots | **High** | L | 9 | tenant routing |
| 19 | Populate `public/images/brand/`; static brand OG fallback | Low | S | 6 | — |
| 20 | ~~`@vercel/blob` (or S3) so uploads stop writing `data:` URLs~~ **Done 2026-10-15** (S3-compatible driver) | ~~High~~ Closed | M | 1 | — |

**Sequencing:** items 1–4 (images, the headline) land first and alone if needed,
because they move LCP the most. 5–14 complete the SEO surface. 15–16 lock it in
with CI. 18 and 20 are cross-phase and tracked here for visibility.

---

## 9. Verification checklist

Objectively checkable. A Phase 6 PR is not done until every box passes.

### Build & quality gates

- [ ] `npm run typecheck` exits 0.
- [ ] `npm run lint` exits 0.
- [ ] `npm run test` exits 0.
- [ ] `npm run build` exits 0.
- [ ] `npm run test:e2e` (Playwright) exits 0, including the axe-core specs.

### Images

- [ ] `npm run check:images` exits 0.
- [ ] Every file under `public/images/**` is **< 200 KB** (`Get-ChildItem -Recurse public\images | Where-Object {$_.Length -gt 204800}` returns nothing).
- [ ] No `.png`/`.jpg` ≥ 200 KB remains in `public/images`.
- [ ] `screenshots/*.png` are absent from `public/` (moved to `docs/assets/` or removed).
- [ ] Exactly one `<Image priority>` per route; it is the LCP element.
- [ ] Every `<Image>` has an explicit `sizes`.
- [ ] Every `<Image>` has intrinsic dimensions or a fixed-aspect wrapper.
- [ ] Inspecting the home page DOM shows a `<link rel="preload" as="image">` for the hero.

### Performance (Lighthouse CI, mobile)

- [ ] Performance ≥ 95 (target 100).
- [ ] Accessibility = 100.
- [ ] Best Practices = 100.
- [ ] SEO = 100.
- [ ] LCP < 2.0 s.
- [ ] CLS < 0.05.
- [ ] TBT < 200 ms (INP proxy).
- [ ] Script transfer < 150 KB gzip on public routes.
- [ ] Home page total resource size < 1.0 MB.
- [ ] `curl -s -o /dev/null -w "%{time_starttransfer}"` on cached HTML shows TTFB < 200 ms.

### SEO

- [ ] Every indexable route emits a self-referencing `<link rel="canonical">` (verify in DOM source).
- [ ] Canonical, OG `og:url`, sitemap and robots URLs all use the **resolved tenant host**, not a hardcoded value.
- [ ] `/checkout`, `/order/[id]`, `/admin/*` emit `<meta name="robots" content="noindex">`.
- [ ] `curl -s http://localhost:3000/sitemap.xml` lists only indexable routes and **no** `/checkout`, `/order/`, `/admin/`.
- [ ] Sitemap `lastModified` values are stable across two consecutive builds (no `new Date()` drift).
- [ ] `curl -s http://localhost:3000/robots.txt` disallows `/admin` and `/api` and points at the correct sitemap host.
- [ ] Every `application/ld+json` block passes the [Rich Results Test](https://search.google.com/test/rich-results) with zero errors.
- [ ] `Restaurant`/`LocalBusiness` data matches `config/site.ts` field-for-field (address, phone, email, opening hours, `sameAs`).
- [ ] No `aggregateRating` is emitted unless backed by real approved reviews.
- [ ] `og:image` resolves (HTTP 200) on `/`, `/menu`, `/menu/[slug]`, `/about`, `/faq`.
- [ ] `manifest.webmanifest` resolves and is linked in `<head>`.
- [ ] `<meta name="theme-color">` present.

### Accessibility

- [ ] axe-core reports zero violations on `/`, `/menu`, `/menu/[slug]`, `/about`, `/contact`, `/faq`.
- [ ] Exactly one `<h1>` per page; no skipped heading levels.
- [ ] Content images have descriptive `alt`; decorative images use `alt=""`.
- [ ] All animation no-ops under `prefers-reduced-motion: reduce`.
- [ ] Keyboard walk reaches every interactive control in a logical order with visible focus.

### Regression guard

- [ ] CI Lighthouse job is required on PRs and fails on any §3 breach.
- [ ] Bundle analyzer confirms cart drawer, checkout modal, dish modifier modal and KDS board are **not** in the initial storefront bundle.

---

**Related documents:** [Master Plan](./MASTER_PLAN.md) · [Audit](./AUDIT.md) ·
[Roadmap](./ROADMAP.md) · [Architecture](./ARCHITECTURE.md) ·
[Testing](./TESTING.md) · [Operations](./OPERATIONS.md) · [Security Policy](../SECURITY.md)

© 2026 Himanshu. All Rights Reserved.
