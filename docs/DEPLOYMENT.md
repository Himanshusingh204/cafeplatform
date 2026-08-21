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

### 1. Push to GitHub (manual — gh CLI not installed on this machine)

```powershell
git remote add origin https://github.com/<your-account>/spice-and-saffron.git
git push -u origin main
```

Then on github.com: enable branch protection for `main` (require the CI check), secret scanning, and Dependabot alerts.

### 2. Provision databases

- Production: create a Postgres database (Vercel Postgres / Neon / Supabase). Copy its pooled connection string.
- Preview: a second database, or branch preview DB if the provider supports it.
- Never point preview at production data.

### 3. Connect repo in Vercel

1. Import the GitHub repo; framework is auto-detected (Next.js).
2. `vercel.json` already sets the build command: `prisma migrate deploy && next build`.
   - `postinstall` runs `prisma generate` automatically (the generated client is gitignored).
3. Set environment variables **per environment**:

| Variable | Production | Preview |
|----------|-----------|---------|
| `DATABASE_URL` | prod DB connection string | preview DB connection string |
| `AUTH_SECRET` | fresh `openssl rand -base64 32` | separate value |
| `APP_URL` | `https://<domain>` | preview URL |
| `EMAIL_API_KEY` | Resend key (optional) | empty or test key |

4. Deploy. First deploy applies migrations to the target DB via the build command.

### 4. Create the production admin

Never reuse dev seed credentials. After the first deploy:

```powershell
# locally, pointed at the PRODUCTION database URL
$env:DATABASE_URL="<prod-url>"; $env:ADMIN_EMAIL="owner@cafe.in"; $env:ADMIN_PASSWORD="<generated>"
npm run create-admin
```

Then rotate/delete the password from any local shell history.

### 5. Pre-launch checklist

- [ ] Remove demo/seed dishes from production DB (§116) or re-seed with real menu
- [ ] Replace placeholder images under `public/images/placeholders/`
- [ ] Verify `/api/health`, sitemap.xml, robots.txt on the live domain
- [ ] Run Lighthouse (target ≥90 across categories)
- [ ] Confirm security headers present (`curl -I https://<domain>`)
- [ ] Enable Vercel Postgres backups (30-day retention) + test one restore

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