# ADR-0005: Decimal money and integer minor units

| Field | Value |
| :--- | :--- |
| **Status** | Accepted |
| **Date** | 2026-10-15 |
| **Deciders** | Himanshu |
| **Supersedes** | _(none)_ |
| **Related** | [ADR-0004](./0004-tenant-isolation-not-null-and-rls.md), [ADR-0006](./0006-idempotency-persisted-not-in-memory.md) |

## Context

Prices are stored correctly as `Decimal(10, 2)` in the schema
(`prisma/schema.prisma:206`, `prisma/schema.prisma:325-330`), but they are
converted to JavaScript `number` and combined with **floating-point arithmetic**
on the read and pricing paths:

- `server/api.ts:118` reads a menu price as `Number(d.price)`.
- `app/api/v1/orders/route.ts:93` computes the subtotal with a float
  `reduce`: `reduce((sum, item) => sum + item.price * item.quantity, 0)`, then
  derives tax with `Math.round(subtotal * 0.05 * 100) / 100`
  (`app/api/v1/orders/route.ts:94`).
- `lib/services/orders.ts` also uses `Number(...)` and float arithmetic
  (`lib/services/orders.ts:107,119,134-135,147-150,182-183`).

Binary floating point cannot represent most decimal fractions exactly, so
repeated addition and percentage math **drift** and produce totals that do not
round-trip: the stored total can disagree with the sum of its parts, and
discount + tax + tip rounding compounds the error. For money, that is a
correctness bug, not a cosmetic one.

There is also a **live security vulnerability** on the same path:
`app/api/v1/orders/route.ts:22` accepts a client-supplied `price`
(`price: z.number().positive()`) and the handler sums it directly into the
subtotal at line 93. A caller can post an arbitrary `price` and have it
persisted, so the client controls the amount charged. The shared
`lib/services/orders.ts` already knows the right pattern — it looks the dish up
and refuses to trust the client price (`lib/services/orders.ts:85-126`) — but the
Route Handler does not use it (see
[ADR-0001](./0001-vnext-route-handlers-as-primary-api.md)).

## Decision

**Money is `Decimal(10, 2)` with an explicit currency, and all arithmetic is done
in decimal or integer minor units — never in JavaScript floats.**

- **Authoritative pricing is computed server-side** in `lib/services/orders.ts`.
  The server looks up each dish and its modifiers and derives the price from the
  database; a **client-supplied price is never trusted**.
- Arithmetic is performed in **integer minor units** (for example paise) or with
  a decimal library, converting to and from `Decimal` only at the database
  boundary.
- Amounts are **rounded exactly once**, at the total, using a single documented
  rounding rule (half-up). Intermediate values are not independently rounded, so
  discount, tax and tip cannot compound rounding error.
- Every monetary value is associated with an **explicit currency**; the platform
  must not silently assume the currency of a number.
- The Route Handler in `app/api/v1/orders/route.ts` is rewritten to delegate to
  `lib/services/orders.ts`, closing the client-price vulnerability.

**Not yet implemented:** the integer-minor-unit arithmetic and the single
round-once rule are the target for the Phase 1 (Deployability & correctness) work
in [`../ROADMAP.md`](../ROADMAP.md). Until then the float paths above remain and
should be treated as known defects.

## Consequences

### Positive

- Totals are **exact and reproducible**: the stored total equals the sum of its
  parts, and recomputation is deterministic.
- The **client-price tampering vulnerability** (`app/api/v1/orders/route.ts:22`)
  is closed by construction once pricing is server-authoritative.
- One rounding rule removes discount/tax/tip drift and makes invoices and
  receipts audit-friendly.
- Handling currency explicitly removes an entire class of "which currency is
  this?" bugs as the platform grows beyond one market.

### Negative

- Requires a small money abstraction and discipline at every call site; a stray
  `Number(...)` reintroduces the bug.
- Existing code that reads money for display (`server/api.ts:118`) must be
  migrated to the decimal/minor-unit representation or a formatter.
- Any historically stored totals produced by the float path may need
  reconciliation.

### Neutral

- The database column type does not change; `Decimal(10, 2)` already stores the
  correct value. This is a computation-layer decision.
- Serialising money to JSON for the API requires a defined convention (for
  example a minor-unit integer plus a currency code), which the API contract must
  document.

## Alternatives considered

- **Continue with JavaScript `number` and round generously at the end.**
  Rejected: it is the current defect; "round at the end" still accumulates float
  error through the intermediate sums and is not reproducible.
- **Store money as a `Float`/`Double` column.** Rejected outright: it institutionalises
  the imprecision this ADR exists to remove.
- **Trust the client's `price` and validate only range.** Rejected: it is the live
  vulnerability. The server must derive the price from its own data.
- **Full multi-currency rounding per line item.** Rejected for now: per-line
  rounding compounds error and complicates tax. The platform rounds once at the
  total; per-currency tax rules can be layered later without changing this
  decision.

## References

- `app/api/v1/orders/route.ts` (client `price` accepted at line 22; float subtotal
  and tax at lines 93-96)
- `server/api.ts` (`Number(d.price)` at line 118)
- `lib/services/orders.ts` (server-authoritative dish lookup at lines 85-126;
  float arithmetic at lines 107, 119, 134-135, 147-150, 182-183)
- `prisma/schema.prisma` (`Decimal(10, 2)` at lines 206, 207, 325, 327-330,
  361, 393, 410, 439, 505-507, 586)
- [`../ROADMAP.md`](../ROADMAP.md) (Phase 1)
- [`../adr/README.md`](./README.md)
