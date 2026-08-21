# TROUBLESHOOTING.md

## Prisma / Database

**`prisma generate` fails** → ensure `DATABASE_URL` set; run `npx prisma generate`.

**`prisma migrate dev` hangs or connection refused** → confirm local Postgres running (`Get-Service postgresql-x64-18`); correct host/port/password in `.env.local`.

**`P1001: Can't reach database server`** → check DATABASE_URL, firewall, and that the DB exists (`CREATE DATABASE indian_cafe;`).

**Seeding fails** → run `npm run db:seed` after migrate; check unique slug conflicts.

## Auth

**Can't log in** → admin must exist in DB (`scripts/create-admin.mjs`). Verify `ADMIN_EMAIL`/`ADMIN_PASSWORD` were set when creating.

**Session keeps expiring** → expected default (24h sliding); check server time sync for dev.

**"Invalid credentials"** → correct email/password; account may be locked temporarily after 5 failed attempts (wait for window).

## Build / TypeScript

**Type errors after adding a page** → run `npm run typecheck`. Check zod schemas vs types.

**Build fails on Vercel** → run `npm run build` locally; ensure migrations applied (`prisma migrate deploy`); env vars set in Vercel dashboard.

## Images

**Upload rejected** → file must be image type (jpg/png/webp/avif/gif), ≤5MB. Non-image extension → rejected.

**Image not showing** → confirm file path exists under `public/images`; dev server running; URL correct in DB.

## Public Menu

**Menu empty** → dishes unpublished or categories inactive; check admin → menu.

**Stale menu** → ISR revalidation delay; trigger revalidate or wait for TTL.

## Rate Limiting

**429 during testing** → limits in `config/limits.ts`; restart server to reset in-memory store (dev only).

## Logs

Server logs include `requestId` for tracing. Never share raw logs publicly (they may contain internal paths).