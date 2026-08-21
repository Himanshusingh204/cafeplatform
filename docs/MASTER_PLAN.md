# MASTER_PLAN.md — Implementation Roadmap

Build in phases. Do **not** jump between phases. After each phase: check code, run tests, fix errors,
verify UI/responsive/security, update `docs/CHANGELOG.md`, then continue.

## Phases

| Phase | Scope | Status |
|-------|-------|--------|
| 0 | Project preparation (docs, identity, config) | ✅ |
| 1 | Foundation (Next.js, TS, Tailwind, design system, layout, nav, footer) | ✅ |
| 2 | Database (Prisma schema, migrations, seed) | ✅ |
| 3 | Authentication (Argon2id, sessions, rate limiting, protected routes) | ✅ |
| 4 | Public website (Home, About, Menu, Gallery, Contact, FAQ, Privacy, Terms, 404) | ✅ |
| 5 | Menu CMS (categories, dishes CRUD, featured, availability, ordering) | ✅ |
| 6 | Contact management (form, validation, spam prevention, admin inbox) | ✅ |
| 7 | Admin dashboard (overview, gallery, settings, activity logs) | ✅ |
| 8 | SEO (metadata, OG, sitemap, robots, JSON-LD, local SEO) | ✅ |
| 9 | Security (auth/authorization review, rate limits, headers, uploads, secrets audit) | ✅ |
| 10 | Performance (images, caching, bundle, animation audit) | ✅ |
| 11 | Accessibility (keyboard, focus, contrast, ARIA, reduced motion) | ✅ |
| 12 | Testing (unit, integration, security — 74 tests on isolated DB) | ✅ |
| 13 | CI/CD (GitHub Actions: ci.yml, security.yml) | ✅ |
| 14 | Production deployment (repo ready; Vercel import + DB provisioning are manual) | 🔶 |
| 15 | Final audit (§128 checklist re-run ✅; live-domain Lighthouse pending deploy) | 🔶 |

🔶 = code-side work complete; remaining steps require external accounts (GitHub push, Vercel import, production database). See `docs/DEPLOYMENT.md`.

## Definition of Done (every feature/page)

UI + backend + database + validation + authorization + error handling + loading state + empty state +
responsive behavior + accessibility + tests + documentation.

## Feature Completion Rule

A feature is complete only when all of the above are present where applicable — not merely because the UI exists.

## Recommended Implementation Order

1. All AI documentation files
2. Lock architecture
3. Create design system
4. Next.js + TypeScript setup
5. PostgreSQL + Prisma
6. Authentication
7. Public layout
8. Homepage
9. Database-driven menu
10. Admin dashboard
11. CRUD
12. Contact system
13. Security layers
14. SEO
15. Animations
16. Performance
17. Tests
18. Security audit
19. Lighthouse
20. Deploy preview
21. Production QA
22. Deploy production
23. Freeze architecture, update BRAIN/MEMORY