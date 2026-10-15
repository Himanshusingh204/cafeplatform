# ADR-0007: Object storage for binaries, never the database

| Field | Value |
| :--- | :--- |
| **Status** | Accepted |
| **Date** | 2026-10-15 |
| **Deciders** | Himanshu |
| **Supersedes** | _(none)_ |
| **Related** | [ADR-0001](./0001-vnext-route-handlers-as-primary-api.md), [ADR-0002](./0002-redis-as-required-production-dependency.md) |

## Context

Image uploads are handled by `app/api/upload/route.ts`, which tries a chain of
fallbacks (`app/api/upload/route.ts:62-91`):

1. **Vercel Blob** — but the module is **not installed** (it is imported
   dynamically at `app/api/upload/route.ts:65` and the production build warns
   `@vercel/blob` is missing). The branch only runs if `BLOB_READ_WRITE_TOKEN`
   is set (`app/api/upload/route.ts:63`), and it fails when the module cannot be
   resolved.
2. **Local filesystem** — `public/uploads/...` (`app/api/upload/route.ts:79-85`).
   This is **read-only on Vercel**, so the write throws.
3. **`data:` URL** — the catch block base64-encodes the entire file into a
   `data:image/...;base64,…` string (`app/api/upload/route.ts:87-89`) and returns
   it as the image URL.

That URL is then persisted as a plain string on the domain model (for example
`Dish.image`, `prisma/schema.prisma:208`). In production, steps 1 and 2 both
fail, so **every upload becomes a base64 `data:` URL stored in PostgreSQL**.
A 1 MB image inflates to roughly 1.3 MB of base64 text in a single row; a handful
of dish images push rows into the megabytes. This:

- **bloats the database** and every query that selects the column,
- **defeats `next/image`**, which cannot optimise a `data:` URL and loses caching,
  resizing and CDN delivery,
- **inflates HTML payloads** wherever the URL is rendered, harming LCP and the
  performance budget in [`../SEO-AND-PERFORMANCE.md`](../SEO-AND-PERFORMANCE.md).

The upload endpoint also validates only the declared MIME type
(`app/api/upload/route.ts:39`), which a client can lie about, and generates
filenames from a timestamp plus randomness
(`app/api/upload/route.ts:54-55`).

## Decision

**Uploaded binaries live in object storage — Vercel Blob or any S3-compatible
store — and never in PostgreSQL.**

- **Install and configure a real object store.** The platform must stop relying
  on a module that is not installed; the object store is a startup dependency, on
  par with the Redis requirement in
  [ADR-0002](./0002-redis-as-required-production-dependency.md).
- **Validate MIME by magic bytes** in addition to the client-supplied
  `Content-Type`, so a renamed or spoofed file cannot pass.
- **Cap size and dimensions** before storage and reject anything over the limit.
- **Use randomised, unguessable object keys** (a cryptographic id plus a
  normalised extension), not predictable timestamps.
- **FAIL the upload rather than substituting a `data:` URL.** If no object store
  is available, the endpoint returns an error; it must never persist base64
  bytes into the database as a silent fallback.

**Implemented:** see [`../../lib/storage/`](../../lib/storage) — a driver abstraction
with a vendor-neutral S3-compatible driver (`@aws-sdk/client-s3`), magic-byte
validation, a size cap, metadata-stripping re-encode, randomised keys, and an
explicit `503` when no store is configured. The `data:` fallback is deleted
(2026-10-15).

## Consequences

### Positive

- The database stays **small and query-fast**; no multi-megabyte rows, no bloat
  in every `SELECT`.
- Objects are served from a **CDN-backed object store**, so `next/image` can
  optimise, resize and cache them — directly serving the performance budget.
- Magic-byte validation plus size caps closes a content-spoofing hole.
- Randomised keys reduce the risk of enumeration and overwrite.

### Negative

- A new external dependency and its credentials (a store account or token) must
  be provisioned, secured and paid for.
- Existing `data:` URLs already persisted in the database must be migrated to
  object storage; until then, some rows remain oversized.
- Uploads become dependent on the store's availability; a store outage means
  uploads fail (correctly, per the fail-closed rule) rather than silently
  degrading.

### Neutral

- The upload endpoint's request/response shape is unchanged: it still returns a
  URL, just a real one.
- Self-hosters may point the S3-compatible configuration at their own store
  rather than Vercel Blob, which keeps the decision provider-neutral.

## Alternatives considered

- **Keep storing base64 `data:` URLs in the database.** Rejected: it is the
  current defect. It bloats rows to megabytes, defeats `next/image`, and harms
  LCP.
- **Store binary blobs in a PostgreSQL `bytea` column.** Rejected: it is not a
  blob store. It couples large-object I/O to the primary transactional database,
  inflates backups and WAL, and still cannot participate in CDN caching.
- **Rely on the local filesystem.** Rejected: read-only on Vercel, and not shared
  across instances.
- **Validate only the client `Content-Type`.** Rejected: it is trivially
  spoofable; magic-byte sniffing is required in addition.
- **Fall back to a `data:` URL when storage is unavailable.** Rejected: a silent,
  harmful fallback that hides a configuration failure. Failing the upload is
  strictly better than corrupting the database.

## References

- `app/api/upload/route.ts` (fallback chain at lines 62-91; Blob import at line
  65; MIME check at line 39; filename at lines 54-55; `data:` URL at lines 87-89)
- `prisma/schema.prisma` (`Dish.image` at line 208; other image columns)
- `.env.example` / [`.env.example`](../../.env.example) (storage variables at
  lines 24-28)
- [`../SEO-AND-PERFORMANCE.md`](../SEO-AND-PERFORMANCE.md),
  [`../ROADMAP.md`](../ROADMAP.md)
- [`../adr/README.md`](./README.md)
