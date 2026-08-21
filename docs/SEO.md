# SEO.md

## Per-Page Metadata

Every public page exports `generateMetadata`:
- `title` (unique, descriptive)
- `description` (120–160 chars, natural)
- canonical URL
- Open Graph (title, description, image, type, url)
- Twitter card
- `alternates`, `robots` (noindex for admin)

## Global

- `app/layout.tsx` sets site-wide defaults + JSON-LD `Restaurant` schema.
- `app/sitemap.ts` — XML sitemap of public routes.
- `app/robots.ts` — allow public, disallow `/admin` and `/api`.
- Structured data: `Restaurant` (LocalBusiness) with name, address, phone, openingHours, sameAs socials, `hasMenu`.

## Local SEO Focus

Natural (no keyword stuffing) around: café name, city, area, Indian restaurant/café, breakfast, lunch, dinner, desserts, local specialties.

## URL Structure

Clean, human-readable:
- `/menu`
- `/menu/butter-chicken`
- `/about`, `/contact`, `/gallery`, `/faq`
- Avoid query-string-only public routes.

## Content Signals

- One `h1` per page, semantic heading hierarchy.
- Meaningful `alt` on every image.
- Internal links between pages.
- Fast Core Web Vitals (see PERFORMANCE.md).
- Valid, descriptive `<title>` and `meta description` on every page.

## Admin Pages

- `robots: { index: false, follow: false }` on `/admin` group.
- No public link to admin.