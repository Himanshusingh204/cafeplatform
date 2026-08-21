# MEMORY.md — Stable Project Facts

Update this file only when the project identity changes, never casually.

```
PROJECT NAME:
Spice & Saffron — Indian Café Website

TYPE:
Production full-stack café website with private admin CMS

DEPLOYMENT:
Vercel (production + previews)

DATABASE:
PostgreSQL 18 (local) / Vercel Postgres (production)

ORM:
Prisma

AUTH:
Secure server-side admin authentication (Argon2id + HttpOnly sessions)

PUBLIC USERS:
Unauthenticated

ADMIN:
Authenticated private user (SUPER_ADMIN role, expandable)

IMPORTANT:
Never expose secrets to the browser.
Never trust client-side validation alone.
Never directly trust request body data.
Never expose database credentials.
Never return unnecessary database fields.
Never create public admin APIs.
Always validate server-side with Zod.
Always rate-limit mutations and login.
Never render unsanitized HTML.
Never log passwords or tokens.
```

## Facts

- Café database name: `indian_cafe`
- Admin role model: `SUPER_ADMIN` → `ADMIN` → `EDITOR` (permission matrix, expandable)
- Primary permissions: `VIEW_MENU`, `CREATE_MENU`, `EDIT_MENU`, `DELETE_MENU`, `MANAGE_GALLERY`, `VIEW_MESSAGES`, `MANAGE_SETTINGS`, `VIEW_ACTIVITY`, `MANAGE_USERS`
- Business info lives in the `Setting` model (key/value) and `config/site.ts`
- Public menu is 100% database-driven
- `docs/BRAIN.md` is the canonical AI memory file