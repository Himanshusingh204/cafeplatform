# ADR-0004: Tenant isolation via NOT NULL tenancy and Row Level Security

| Field | Value |
| :--- | :--- |
| **Status** | Accepted |
| **Date** | 2026-10-15 |
| **Deciders** | Himanshu |
| **Supersedes** | _(none)_ |
| **Related** | [ADR-0001](./0001-vnext-route-handlers-as-primary-api.md), [ADR-0005](./0005-decimal-money-and-integer-minor-units.md) |

## Context

The platform is multi-tenant, but isolation is currently **advisory and partly
broken**:

- **Unknown tenants silently fall back to the default tenant.**
  `lib/db/tenant.ts:54-67` returns the flagship tenant for any unknown or
  inactive slug instead of failing. A request for tenant `acme` with no matching
  row will read and write the default tenant's data.
- **Tenant reads widen to include `NULL` tenant rows.** Tenant-scoped queries are
  written as `OR: [{ tenantId }, { tenantId: null }]`
  (`app/api/v1/orders/route.ts:47`; `server/api.ts:164` and `server/api.ts:192`).
  This both **leaks the default tenant's data** into every other tenant's results
  and **defeats index seeks**, because the `OR` cannot use a single
  `(tenantId, …)` index.
- **Uniqueness is global, not per tenant.** `Dish.slug`, `Category.slug`
  (`prisma/schema.prisma:181`, `prisma/schema.prisma:203`), `Coupon.code`
  (`prisma/schema.prisma:437`), `Setting.key` (`prisma/schema.prisma:285`),
  `Admin.email` (`prisma/schema.prisma:146`) and `CustomerUser.email`
  (`prisma/schema.prisma:582`) are `@unique` globally, and `Order.orderNumber`
  (`prisma/schema.prisma:317`) is globally unique. Two tenants can therefore
  **block each other** from using a slug, coupon code, setting key or email, and
  order numbers collide across tenants.
- **Tenancy is nullable.** `tenantId` is `String?` on `Dish`, `Category`,
  `Order`, `Reservation`, `Admin`, `Ingredient`, `DiningTable`, `WaitlistEntry`
  and `CustomerUser`, so a row can exist with no owner at all.

The combination means tenant data is neither reliably partitioned nor reliably
addressable. This is the single highest-risk correctness and security issue in
the audit.

## Decision

Enforce tenant isolation at the schema, query and database layers:

1. **Backfill `tenantId`, then make it `NOT NULL`.** Every tenant-scoped model
   must carry an owner. The existing `null` rows are resolved to the default
   flagship tenant before the column is tightened.
2. **Replace global uniqueness with tenant-scoped composite keys.** For example
   `@@unique([tenantId, slug])` replaces the global `Dish.slug` and `Category.slug`
   uniqueness; the same treatment applies to `Coupon.code`, `Setting.key`,
   `Admin.email`, `CustomerUser.email` and `Order.orderNumber`.
3. **Resolve tenants strictly and FAIL CLOSED.** An unknown or inactive tenant
   resolves to a **`404`**, never to the default tenant. The default-tenant
   fallback in `lib/db/tenant.ts:54-67` is removed.
4. **Remove the `OR: [{ tenantId }, { tenantId: null }]` pattern** from
   `app/api/v1/orders/route.ts:47`, `server/api.ts:164` and
   `server/api.ts:192`; tenant queries filter on `tenantId` alone so they can use
   the composite indexes.
5. **Add Postgres Row Level Security (RLS) as defence in depth**, using a
   `SET LOCAL app.tenant_id = '<uuid>'` pattern inside the request's transaction,
   with policies that restrict each row to the current tenant.

6. **Migration safety:** the change is applied as **expand → backfill →
   contract**, and any index that could lock a hot table is created with
   `CREATE INDEX CONCURRENTLY` **outside a transaction**.

**Not yet implemented:** items 1-5 are the target for the Phase 2 (Database
integrity & indexing) and Phase 4 (Security hardening) work in
[`../ROADMAP.md`](../ROADMAP.md). The schema today still shows nullable
`tenantId` and global uniques (see `prisma/schema.prisma:146,181,203,285,317,437,582`).

## Consequences

### Positive

- **Cross-tenant data leakage is eliminated** at three independent layers:
  strict resolution, `NOT NULL` ownership, and RLS.
- Tenant-scoped queries become **index-friendly** (`(tenantId, …)` seeks) instead
  of `OR` scans, improving the slow `Dish.findMany` observed at build time.
- Tenants stop colliding on slugs, coupon codes, setting keys, emails and order
  numbers; each is scoped to its owner.
- RLS provides a backstop so that a future code-path bug cannot read across
  tenants even if the application filter is forgotten.

### Negative

- Composite uniqueness changes key semantics; existing data must be inspected for
  **cross-tenant collisions** before the contract step, and duplicates resolved.
- `NOT NULL` requires a completed, verified backfill; rushing it risks failed
  migrations on production data.
- RLS policies must be maintained alongside the schema, and the `SET LOCAL`
  pattern requires every database access to run inside a tenant-scoped
  transaction — including the worker from
  [ADR-0003](./0003-durable-outbox-job-queue.md).

### Neutral

- `CREATE INDEX CONCURRENTLY` cannot run inside a transaction, so migration and
  index creation are separated into distinct steps.
- The public API contract for a valid tenant is unchanged; only the behaviour for
  an **invalid** tenant changes, from "silently the default tenant" to `404`.

## Alternatives considered

- **Application-level filtering only (no RLS).** Rejected: a single forgotten
  `where` clause then leaks data across tenants, and the current code already
  demonstrates that pattern. RLS is cheap defence in depth.
- **A schema-per-tenant or database-per-tenant model.** Rejected for this
  platform's scale: it multiplies migration and connection overhead and is far
  more complex to operate than composite keys plus RLS on one database.
- **Keep nullable `tenantId` and treat `null` as "global/shared".** Rejected:
  that is the current defect, and it is precisely what the `OR … null` queries
  exploit to leak data. There is no legitimate need for an ownerless row.
- **Keep global unique constraints and accept cross-tenant collisions.**
  Rejected: it prevents two tenants from independently using the same natural
  key and produces confusing failures.

## References

- `lib/db/tenant.ts` (default-tenant fallback for unknown slugs, lines 54-67)
- `app/api/v1/orders/route.ts` (`OR … tenantId: null` at line 47)
- `server/api.ts` (`OR … tenantId: null` at lines 164 and 192)
- `prisma/schema.prisma` (nullable `tenantId` at lines 145, 179, 200, 292, 316,
  502, 535, 559, 580; global uniques at lines 146, 181, 203, 285, 317, 437, 582)
- `lib/auth/s2s.ts` (tenant resolution for API keys, lines 96-137)
- [`../DATABASE.md`](../DATABASE.md), [`../ROADMAP.md`](../ROADMAP.md)
- [`../adr/README.md`](./README.md)
