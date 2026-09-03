# API_SPECIFICATION.md

## Response Shape

Success:
```json
{ "success": true, "data": {} }
```

Error:
```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "Please check the submitted fields." } }
```

Internal details stay in server logs only.

## Error Codes

`VALIDATION_ERROR` · `UNAUTHORIZED` · `FORBIDDEN` · `NOT_FOUND` · `RATE_LIMITED` · `CONFLICT` ·
`PAYLOAD_TOO_LARGE` · `INVALID_INPUT` · `SERVER_ERROR`

## Endpoints

### Public

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/health` | GET | none | Health check (status only) |
| `/api/contact` | POST | none (rate-limited + honeypot) | Submit contact message |

Public pages read directly via Server Components (`getMenu()`, `getCategories()`, `getGallery()`), not via API.

### Admin (all require session + permission + rate limit)

| Route | Method | Permission | Purpose |
|-------|--------|-----------|---------|
| `/api/auth/login` | POST | — | Login (rate-limited) |
| `/api/auth/logout` | POST | — | Logout |
| `/api/notifications` | GET | session required | SSE real-time notifications (new messages) |
| `/api/menu/categories` | GET/POST | VIEW_MENU/CREATE_MENU | List/create categories |
| `/api/menu/categories/[id]` | PATCH/DELETE | EDIT_MENU/DELETE_MENU | Update/delete category |
| `/api/menu/dishes` | GET/POST | VIEW_MENU/CREATE_MENU | List/create dishes |
| `/api/menu/dishes/[id]` | PATCH/DELETE | EDIT_MENU/DELETE_MENU | Update/delete dish |
| `/api/gallery` | GET/POST | VIEW_MENU/MANAGE_GALLERY | List/upload gallery |
| `/api/gallery/[id]` | PATCH/DELETE | MANAGE_GALLERY | Update/delete image |
| `/api/messages` | GET | VIEW_MESSAGES | List messages |
| `/api/messages/[id]` | PATCH | VIEW_MESSAGES | Update status |
| `/api/settings` | GET/PATCH | VIEW_MENU/MANAGE_SETTINGS | Read/update settings |
| `/api/activity` | GET | VIEW_ACTIVITY | Activity logs (paginated) |
| `/api/upload` | POST | any write permission | Image upload (validated) |

## Rate Limits (configurable in `config/limits.ts`)

- Login: 5 attempts / 15 min / IP + account
- Contact: 3 / 10 min / IP
- Admin mutations: 60 / min / session
- Public reads: 300 / min / IP

## Auth Headers

Sessions use HttpOnly cookies. Route handlers read session server-side. No bearer tokens in localStorage.

## Validation

Every payload is parsed with a Zod schema (`lib/validation/*`). Unknown fields are stripped (no mass assignment).

## Logging

Structured logs: timestamp, level, event, route, requestId, userId, result, duration. Never log secrets.