# PERFORMANCE.md

## Goals

- Lighthouse Performance / Accessibility / Best Practices / SEO: **90+** where realistic.
- Fast initial render: SSR/SSG public pages, minimal client JS.
- No layout shift, smooth interactions.

## Images

- Framework `<Image>` (optimization, sizing, lazy-loading below the fold, `priority` for hero/LCP).
- Source images ≤ ~2000px, WebP output. Never ship 5000px photos.
- Explicit `width`/`height` or aspect-ratio to prevent CLS.
- `sizes` attributes tuned per breakpoint.

## JavaScript Budget

- Keep client JS minimal. Server Components for rendering; client only for interaction.
- Avoid heavy dependencies. Every library justified (see DEPLOYMENT dependency policy).
- Lazy-load heavy sections below the fold (e.g. gallery).

## Caching

- Public menu/gallery cached with `revalidate` (ISR) — content changes infrequently.
- Private/admin pages always fresh (`no-store`).
- Static assets: long-lived cache headers (Vercel defaults).

## Database

- Query only needed fields (`select`).
- Indexed filters (see DATABASE_SCHEMA).
- Single Prisma client. Avoid N+1 (use `include`/`select` joins).
- Pagination for large lists (messages, activity).

## Animation Performance

- Animate only `transform` / `opacity` (GPU-friendly).
- No animation of `width`/`height`/`top`/`left`/large blurs.
- Respect `prefers-reduced-motion`.

## Fonts

- `next/font` with `display: swap`. Preload only the primary display font weights actually used.
- Avoid loading many weights.

## Third-Party

- Minimal scripts. No 15 tracking scripts. Privacy-conscious analytics if any.
- No render-blocking third-party CSS/JS on critical path.

## Budgets

- Avoid excessive client JS bundle (> ~170KB gzip client is a warning threshold).
- Avoid giant image payloads (hero ≤ ~200KB WebP).
- No unnecessary layout shifts (stable dimensions everywhere).