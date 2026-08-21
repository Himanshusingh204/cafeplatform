# DEPLOYMENT.md

## Environments

| Env | Database | Purpose |
|-----|----------|---------|
| Local | `indian_cafe` (local Postgres) | Development |
| Preview | Vercel Postgres (preview) | Pull request previews |
| Production | Vercel Postgres (prod) | Live site |

Never use the production database for local development.

## Local Setup

1. `cp .env.example .env.local`, fill `DATABASE_URL`, `AUTH_SECRET`, `APP_URL`.
2. `npm install`
3. `npx prisma migrate dev` → creates tables
4. `npm run db:seed` → dev data + setup admin
5. `npm run dev`

## Vercel Deploy

1. Connect GitHub repo to Vercel.
2. Set env vars per environment (production + preview): `DATABASE_URL`, `AUTH_SECRET`, `EMAIL_API_KEY`, `APP_URL`.
3. Build command: `npm run build` (runs `prisma generate` + `prisma migrate deploy`).
4. Promote preview → production after QA.

## Migrations

- Local: `npx prisma migrate dev`
- Deploy: `npx prisma migrate deploy` (non-interactive)
- Never hand-edit production schema.

## Env Vars

- `DATABASE_URL` — PostgreSQL connection (server only)
- `AUTH_SECRET` — signing/encryption secret (server only)
- `EMAIL_API_KEY` — Resend (optional; contact notification)
- `STORAGE_*` — Vercel Blob / S3-compatible (server only)
- `APP_URL` — canonical site URL
- `NODE_ENV` — set by platform

## Backups

- Enable automatic Vercel Postgres backups + retention (30 days).
- Test restore procedure quarterly. A backup never restored is not trusted.
- Migration backups: `pg_dump` before schema changes in production.

## Monitoring

- Error monitoring (Sentry or Vercel Analytics) — never send secrets to it.
- `/api/health` used by uptime checks.

## Rollback

- Revert commit → Vercel redeploys previous build.
- For DB schema issues: apply down-migration if available, else restore from backup, then redeploy.