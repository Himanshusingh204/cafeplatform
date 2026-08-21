# VALIDATION_RULES.md

All validation is enforced **server-side** with Zod. Client validation exists for UX only and is never trusted.

## Common Rules

- Trim all string inputs.
- Reject obviously invalid payloads; strip unknown fields (`.strict()` where safe, otherwise `.passthrough` disabled).
- Maximum lengths on every field — never unbounded.

## Name (dish, category, gallery, message sender)

- Required
- Min 2 chars, Max 120 chars
- Trimmed

## Slug

- Auto-generated from name via `slugify()`.
- Unique per table. Regenerated on create; optionally editable by admin (max 120, `^[a-z0-9-]+$`).

## Price (dish)

- Required
- Number, > 0
- Max 99999
- Max 2 decimal places (round on save)

## compareAtPrice

- Optional
- Same rules as price; must be > price if present (marketing compare)

## Email (admin, contact)

- Required
- Valid format
- Max 254 chars
- Lowercased/normalized

## Phone (contact)

- Optional
- Validated against India-friendly pattern: 6–15 digits, allow `+`, spaces, dashes
- Max 20 chars
- Reject absurd digit runs (e.g. 20+ digits)

## Description / Message

- Message: required, min 10, max 2000
- Short description: max 200
- Full description: max 2000
- Strip control characters; allow newlines only in description/message

## Subject (contact)

- Required, min 2, max 120

## Preparation Time / Calories

- Optional integers, 1–480 and 1–5000

## Dietary Flags

- Booleans only (isVegetarian, isVegan, isSpicy, containsNuts, isFeatured, isAvailable)

## Sort Order

- Integer, 0–9999

## Image

- URL string (upload-returned path) max 500, or empty. Server validates the stored file itself.

## Admin (login)

- Email: valid, max 254
- Password: required, min 8, max 128 (hash never stored in plaintext)

## Settings Values

- Key: from known allow-list
- Value: max 5000 chars

## Rate-Limit Context

- IP: normalized, hashed for storage (contact messages store `ipHash` only).

## Query Params (lists)

- `page`: int ≥ 1
- `pageSize`: 1–100
- `sort`: allow-list (`name`, `price`, `createdAt`, `sortOrder`)
- `dir`: `asc` | `desc`
- `category`: uuid or empty
- `search`: max 120, trimmed
- `status`: enum or empty
- `featured` / `available`: `true` | `false` or empty