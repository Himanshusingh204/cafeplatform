# IMAGES & VIDEOS TO ADD

Your site works with placeholders. Follow this guide to replace them with real or AI-generated visuals.

---

## 1. STATIC IMAGES (replace placeholders)

Put files in `public/images/` — the site references these paths directly.

| # | File Path | Used Where | Prompt (for AI image generators like Midjourney, DALL-E, Ideogram) |
|---|-----------|------------|-------------------------------------------------------------------|
| 1 | `public/images/placeholders/hero-placeholder.jpg` | Homepage hero background | `A warm, inviting Indian café interior at lunchtime. Natural light through large windows. Wooden tables, terracotta pots, brass accents. A tandoor visible in the open kitchen. Soft bokeh. Shot on 35mm film. Cinematic, editorial style. 16:9 aspect ratio.` |
| 2 | `public/images/placeholders/about-placeholder.jpg` | About page + homepage about section | `Interior of a premium Indian café in Hauz Khas, Delhi. Warm wood tones, exposed brick, hanging Edison bulbs. A chalkboard menu on the wall. Cozy, lived-in feel. Natural light. Editorial photography style. 4:3 aspect ratio.` |
| 3 | `public/images/placeholders/chef-placeholder.jpg` | About page "From our kitchen" section | `An Indian chef working at a clay tandoor oven. Flour-dusted hands pulling fresh naan. Warm amber lighting. Steam rising. Candid, documentary style. Shallow depth of field. 4:3 aspect ratio.` |
| 4 | `public/images/placeholders/dish-placeholder.jpg` | All dish cards when no image uploaded | `A beautifully plated Indian curry in a copper bowl. Fresh coriander garnish. Warm lighting. Rustic wooden table. Overhead shot. Food photography, editorial style. Clean background.` |

---

## 2. MENU DISH IMAGES (add via admin dashboard)

Upload to `public/images/menu/` then set the path in Admin > Dishes > Edit > Image field.

**Recommended dishes to photograph/generate:**

| Dish Name | Suggested Prompt |
|-----------|-----------------|
| Butter Chicken | `Creamy butter chicken in a copper handi. Garnished with cream swirl and coriander. Warm lighting. Rustic wooden table. Food photography, top-down angle.` |
| Paneer Tikka | `Charcoal-grilled paneer tikka on a sizzling plate. Bell peppers and onions. Smoky atmosphere. Dramatic side lighting. Food photography.` |
| Dal Makhani | `Rich, dark dal makhani in a brass bowl. Pat of butter melting on top. Fresh naan on the side. Warm, moody lighting. Overhead shot.` |
| Biryani | `Hyderabadi dum biryani in a handi, saffron rice layers visible. Raita and salan on the side. Garnished with fried onions and mint. Top-down food photography.` |
| Naan / Bread | `Fresh tandoori naan being pulled from a clay oven. Flour dust in the air. Warm amber light. Candid kitchen moment.` |
| Samosa | `Crispy golden samosas on a plate with green chutney and tamarind sauce. Rustic setting. Warm natural light. Close-up food photography.` |
| Chai | `Masala chai in a clay kulhad cup. Steam rising. Cinnamon sticks and cardamom pods nearby. Warm, cozy atmosphere. Close-up.` |
| Mango Lassi | `Tall glass of mango lassi topped with saffron strands. Fresh mango slices beside it. Bright, summery lighting.` |

---

## 3. GALLERY IMAGES (add via admin dashboard)

Upload to `public/images/gallery/` then add via Admin > Gallery > Add Image.

**Recommended gallery shots (8-12 images ideal):**

| # | Category | Prompt |
|---|----------|--------|
| 1 | Interior | `Wide shot of an Indian café interior. Warm wood, brass fixtures, hanging plants. Customers dining. Natural light. Architectural photography.` |
| 2 | Interior | `Close-up of a café table setting. Ceramic plate, brass cutlery, cloth napkin. Blurred background. Editorial style.` |
| 3 | Food | `Overhead flat-lay of an Indian thali spread. Multiple small bowls. Roti, rice, pickles, dal, vegetables. Food photography.` |
| 4 | Food | `Tandoor oven with naan bread stuck to the sides. Glowing coals. Warm amber light. Action shot.` |
| 5 | Food | `A pair of hands breaking open a crispy samosa. Steam escaping. Close-up, candid moment.` |
| 6 | People | `Friends laughing over a table of Indian food. Candid, warm atmosphere. Natural light from a window. Lifestyle photography.` |
| 7 | Detail | `Close-up of whole spices — cardamom, cinnamon, cloves, bay leaves — on a wooden surface. Warm lighting. Still life.` |
| 8 | Detail | `Chai being poured from a height into a kulhad. Stream of tea, steam rising. Action shot. Dark background.` |
| 9 | Exterior | `Café exterior at golden hour. Warm light spilling out. Signage visible. A few people outside. Street photography style.` |
| 10 | Kitchen | `Chef plating a dish in a professional kitchen. Focused expression. Warm overhead lighting. Documentary style.` |

---

## 4. OPTIONAL: VIDEO CONTENT

If you want to add video (not currently in the codebase, but can be added):

| # | Where | What | Prompt / Shot List |
|---|-------|------|-------------------|
| 1 | Homepage hero (optional) | 5-10 second looping background video | `Slow-motion footage of naan being pulled from a tandoor. Warm lighting. Steam rising. Cinematic. 4K.` |
| 2 | About page | 15-30 second café atmosphere video | `Walking through an Indian café. Pan across the kitchen, tables, spices. Warm, inviting. Steadicam shot.` |
| 3 | Gallery page | Short clips mixed with photos | `Close-up of chai being poured. Sizzling tandoori on the grill. Hands kneading dough. Slow motion.` |

**To add video to the site**, place files in `public/videos/` and use HTML5 `<video>` tag or a component like:
```tsx
<video autoPlay muted loop playsInline className="w-full h-full object-cover">
  <source src="/videos/your-video.mp4" type="video/mp4" />
</video>
```

---

## 5. IMAGE SPECS

| Property | Recommended |
|----------|-------------|
| Format | WebP or AVIF (optimized by Next.js automatically) |
| Hero image | 1920x1080px minimum |
| Dish images | 800x600px minimum |
| Gallery images | 1200x900px minimum |
| About/Chef images | 1200x900px minimum |
| File size | Under 500KB each (use Squoosh.app to compress) |

---

## 6. QUICK START (minimum to look real)

Replace these 4 placeholder files and the site will look professional:

1. `public/images/placeholders/hero-placeholder.jpg` — café interior wide shot
2. `public/images/placeholders/about-placeholder.jpg` — café interior detail
3. `public/images/placeholders/chef-placeholder.jpg` — chef at tandoor
4. `public/images/placeholders/dish-placeholder.jpg` — one beautiful curry dish

Then add 3-5 menu dish images via Admin > Dishes, and 6-8 gallery images via Admin > Gallery.
•] Add middleware for global security (bot blocking, request size, SQL/XSS patterns)
[ ] Add IP blocking system (blocklist + auto-block on abuse)
[ ] Add request sanitization (XSS, SQL injection patterns)
[ ] Add stricter security headers
[ ] Add bot detection (suspicious user agents, headless browsers)
[ ] Final quality gates (lint, typecheck, build)
Objective
Premium Indian café website (Spice & Saffron) — Next.js 16/TypeScript/Tailwind v4/Prisma 7/PostgreSQL with private admin CMS, focusing on bug fixes, performance optimization, security hardening, database querying improvements, dead code removal, and ensuring deployment readiness with no AI-generated patterns.
Important Details
- Stack: Next.js 16.3.1 (App Router) · TypeScript · Tailwind CSS v4 · Prisma 7 + PostgreSQL · Argon2id auth · Zod validation · Framer Motion
- 20 phases completed; project deployment-ready; all quality gates (lint, typecheck, build) pass
- Rate limiting per IP already configured (limits.contact: 3 submissions/10min window)
- Input validation schemas already exist (emailSchema with .email(), phoneSchema with .regex())
- Honeypot and minimum interaction time guards on contact form prevent bot abuse
- AI-pattern fixes completed (footer tagline, hero timestamp, dish delete wording)
- Dead code removed: CSRF module, 3 hooks, 3 UI components, 5 dead exports
- IMAGES_TO_ADD.md created with prompts for placeholder replacement
- SSE notifications, contact page crash, origin checks, email notifications, hasPermission all fixed
Work State
Completed
- SSE cancel handler cleanup fixed (parameter mismatch dead code)
- Contact page JSON.parse openingHours crash — added try/catch
- Origin check HTTP status codes: invalid origins → 403 instead of 422/401
- Email notification blocking: fire-and-forget with void instead of await
- hasPermission defensive check for invalid role values (returns false instead of throwing)
- Admin role display: replaceAll → replaceAll for multi-underscore roles (e.g. SUPER_ADMIN)
- ISR revalidate = 300 added to all 8 public pages (homepage, menu, gallery, about, contact, FAQ, terms, privacy)
- Image format optimization: avif + webp formats; tuned deviceSizes/imageSizes in next.config.ts
- Gallery preview uses cached getPublishedGallery() instead of direct DB call
- getDishBySlugCached replaced with direct db.dish.findFirst (avoids loading entire menu)
- updateSettings upserts batched in db.$transaction() (11 round-trips → 1)
- fetchMenu added select to avoid transferring full description text on list views
- getSession added select to avoid loading passwordHash into memory
- fetchPublishedGallery added select to avoid fetching unused columns
- logAction wrapped in try/catch — logging failures no longer crash mutations
- Dead code removed: lib/security/csrf.ts, hooks/use-csrf.ts, hooks/use-media-query.ts, hooks/use-debounce.ts, hooks/use-toast.ts, components/ui/select.tsx, components/ui/form-field.tsx, components/ui/pagination.tsx, tests/unit/csrf.test.ts, lib/security/ empty dir
- Dead exports removed: createRequestId, formatDate, getCategoryAdmin, notFound/conflict/upload/pagination
- IMAGES_TO_ADD.md created with prompts for 4 placeholder images, 8 menu dishes, 10 gallery shots
- Build, lint, typecheck all pass clean
Active
- (none — all 20 phases complete)
Blocked
- (none)
Next Move
1. (none — project deployment-ready)
2. Manual external steps: push to GitHub, provision prod/preview databases, import repo in Vercel, create production admin, replace placeholder images (per IMAGES_TO_ADD.md), run Lighthouse on live domain
Relevant Files
- IMAGES_TO_ADD.md — new file with image replacement prompts and exact paths
- lib/validation/schemas.ts — contact form validation (emailSchema, phoneSchema, messageSchema with honeypot/timing guard)
- app/api/contact/route.ts — contact endpoint with origin check, IP rate limiting, honeypot, minimum interaction time guard
- config/limits.ts — rate limit config (limits.contact: 3/10min per IP)
- next.config.ts — image format optimization (avif/webp), tuned deviceSizes/imageSizes
- lib/services/settings.ts — batched transaction updates, select optimization, try/catch fallbacks
- lib/services/menu.ts — direct dish lookup, select optimization, try/catch fallbacks
- lib/services/gallery.ts — select optimization, try/catch fallbacks
- app/sitemap.ts — dynamic sitemap with dish pages, graceful DB fallback
- docs/MASTER_PLAN.md — all 20 phases marked ✅
- docs/CHANGELOG.md — Phases 16-20 documented
- docs/DEPLOYMENT.md — database provisioning providers and steps updated
- public/images/placeholders/ — 5 placeholder images to replace per IMAGES_TO_ADD.md
- components/home/gallery-preview.tsx — now uses cached getPublishedGallery() service
- app/api/notifications/route.ts — SSE endpoint with fixed cancel handler