# Phase 1 Completion Plan

**Project:** Spice & Saffron — Indian Fine Dining & Café Platform
**Owner:** Himanshu ([@Himanshusingh204](https://github.com/Himanshusingh204))
**Status:** 🟡 **Proposed — awaiting review.** Nothing in this document is implemented yet unless it is ticked in §2.
**Last updated:** 2026-10-15
**Baseline commit:** `25b942d` (working tree clean, all gates green)

This is the reviewable execution plan for the remainder of **Phase 1 — Deployability &
correctness** in [ROADMAP.md](../ROADMAP.md). It is deliberately more granular than the roadmap:
it records the evidence each decision rests on, the exact steps, and the questions that need a
human answer before or during implementation.

---

## 1. How to read this document

| Section | What it gives you |
| :--- | :--- |
| §2 | What Phase 1 has already shipped, and what is left. |
| §3 | Scope boundary — what this plan will **not** touch. |
| §4 | The doctrine every change in this plan follows. |
| §5 | **Reconnaissance findings** — every fact this plan depends on, with `file:line` evidence. |
| §6–§8 | The three workstreams (A deployability, B money, C runtime parity). |
| §9 | Test and gate matrix — how each workstream proves itself. |
| §10 | Risks and rollback. |
| §11 | **Open questions for review** — each with a recommendation. |
| §12 | Commit sequencing. |

Reviewers: the questions in §11 are the parts where I want a human decision. Everything else is
implementation I intend to carry out as written.

---

## 2. Where Phase 1 stands

### Shipped

| Finding | What was wrong | Where it stands now |
| :--- | :--- | :--- |
| **P0-1** pricing | `POST /api/v1/orders` summed a **client-supplied `price`** | ✅ Delegates to `createOrder`; catalog price is authoritative (`ad06e78`) |
| **P0-1** order numbers | `ORD-####` on a globally-unique column — 9 000 values | ✅ `ORD-YYMMDD-XXXXXX` (Crockford base32) + P2002 retry (`ad06e78`) |
| **P0-1** duplication | A retried POST created a duplicate order; no rate limit | ✅ `Idempotency-Key` + 60 req/min per API key (`25b942d`) |
| **P0-4** uploads | `@vercel/blob` (never installed) → FS → base64 `data:` URL in Postgres | ✅ `lib/storage/` + S3-compatible driver, fail-closed `503` (`ac78fb3`) |
| **P0-5** email | `EMAIL_DISPATCH` only logged | ✅ Sends via notifier, throws on failure (`ad06e78`) |

### Remaining (the subject of this plan)

| # | Item | Roadmap ref |
| :--- | :--- | :--- |
| **A** | Reconcile `vercel.json`; prove the API is reachable on the deployed URL | §1.4, P0-4 remainder |
| **B** | Replace the hardcoded 5 % tax and float money arithmetic (P1-7) | §1.3, §2.4, ADR-0005 |
| **C** | Thin `server/api.ts` into a service adapter; minimal two-adapter parity smoke | §1.2 |

---

## 3. Scope boundary

**In scope:** A, B, C as described in §6–§8, plus the documentation and `CHANGELOG.md` entries
they require.

**Explicitly out of scope** (owned by later phases — listed so a reviewer does not expect them
here):

- Making Redis a hard requirement, and removing the silent in-memory fallback (Phase 3).
- The durable outbox, replacing `lib/queue/job-queue.ts` and its `setInterval` (Phase 3).
- `tenantId NOT NULL`, fail-closed `resolveTenant`, composite indexes, connection-pool bounds,
  `EXPLAIN` evidence (Phase 2).
- Tenant-scoping the `Setting` model (Phase 2).
- `npm audit` remediation (Phase 4).
- Lighthouse / SEO / Core Web Vitals work (Phase 7).
- A Dockerfile or container packaging. **None exists today** (§5, F2). This plan does not add
  one; it corrects the documentation that implies one exists.

---

## 4. Doctrine for every change in this plan

1. **Config over hardcode, and human-readable.** A literal that a human might want to change
   (`0.05`, `"INR"`, `300`) lives in `config/` or a named export with a comment, never inline in
   a code path.
2. **Fail closed on the money path.** An unavailable dependency must produce an error, never a
   silently degraded result.
3. **One codebase, two runtimes, one service layer.** Adapters hold transport concerns only; all
   business rules live in `lib/services/*` so the runtimes cannot drift.
4. **Docs and `CHANGELOG.md` move in the same commit as the code.** A behaviour change without
   its document update is an incomplete change.
5. **Evidence over assertion.** Every claim in this plan cites `file:line` and was verified at
   `25b942d`.

---

## 5. Reconnaissance findings (evidence)

These are the facts the plan rests on. A reviewer can check any of them directly.

| # | Finding | Evidence | Why it matters |
| :--- | :--- | :--- | :--- |
| **F1** | The Vercel build command runs `prisma migrate deploy` **on every deployment**, including previews. | `vercel.json:4` | If a preview deployment shares `DATABASE_URL` with production, merging a branch can migrate the production database. This is the most dangerous thing in this workstream. |
| **F2** | There is **no Dockerfile, no docker-compose, and no CI workflow** in the repository. | `glob {Dockerfile*,docker-compose*,.github/workflows/*}` → no files | "Express for Docker/self-hosting" is documented but nothing packages it. Either it gets packaging or the docs stop implying it already exists. |
| **F3** | The KDS SSE route declares no `maxDuration`. | `app/api/v1/realtime/kds/route.ts:6` (only `dynamic`) | Verified platform limits: with Fluid compute (default) the **default and maximum on Hobby is 300 s**; Pro/Enterprise allow up to 800 s. The cap is real and currently invisible in the code. |
| **F4** | The SSE stream sends no `id:` field, so an `EventSource` reconnect cannot resume. | `app/api/v1/realtime/kds/route.ts:47–78`; client `components/admin/kds-board.tsx:156` | `EventSource` reconnects automatically, but any ticket created during the gap is lost until the board is refreshed. Phase 3 (Redis pub/sub) fixes the delivery; this plan only documents it. |
| **F5** | Tax is hardcoded at 5 % in the money path. | `lib/services/orders.ts:225` — `Math.round(taxableAmount * 0.05)` | A café in another state/country cannot configure its rate without a code change. |
| **F6** | Money is computed in JavaScript floats, then stored as `Decimal(10,2)`. | `lib/services/orders.ts:190–226`; `prisma/schema.prisma:325–330` | The service and the database disagree about the type of money. `0.1 + 0.2` problems are rounded away by luck, not by design. Contradicts ADR-0005. |
| **F7** | `Tenant` has **no** tax-rate or currency column, and `Setting` is **global** (`key @unique`, no `tenantId`). | `prisma/schema.prisma:117–141`; `prisma/schema.prisma:283–288` | A genuinely *per-tenant* tax rate needs a schema change. That change belongs to Phase 2 ("Database integrity & indexing"), which is the next phase anyway. |
| **F8** | The Express adapter has **no** `POST /api/v1/orders` at all. | `AUDIT.md` §P0-1 ("`server/api.ts` has no order-creation endpoint at all") | The advertised two-runtime parity has no order path to compare, so a parity test currently has almost nothing to assert. |
| **F9** | The Express idempotency middleware keys on the **raw header only**. | `server/middleware/idempotency.ts:12–23` | The Next route keys on `tenantId:operation:<key>` + a payload fingerprint (`lib/api/request-guards.ts`). This divergence was introduced knowingly in `25b942d` and is closed in workstream C. |
| **F10** | The deployment verifier never probes the API surface. | `scripts/verify-deployment.mjs:39–130` (health, headers, robots, sitemap, public pages, admin redirect) | The P0-4 acceptance criterion — "the API is reachable on the deployed URL" — has **no test**. Today a deploy that silently dropped every Route Handler would still pass verification. |
| **F11** | `export const runtime = "nodejs"` is redundant in Next 16. | `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/02-route-segment-config/runtime.md` | `nodejs` is the default and the Edge runtime is deprecated. Harmless, but worth not spreading further. |

---

## 6. Workstream A — deployability (P0-4 remainder)

**Goal:** the deployed URL serves the API, and nothing in the repository can migrate the
production database by accident.

### A1 · Guard migrations to production builds only  → fixes F1

Replace the inline build command with a small Node script so the behaviour can branch on a
verified platform variable (`VERCEL_ENV` ∈ `production` | `preview` | `development`, available at
build time).

`scripts/vercel-build.mjs`:

- Skip `prisma migrate deploy` **only** when `VERCEL_ENV` is explicitly `preview` or
  `development`, and log that it skipped.
- Run migrations in every other case (including `VERCEL_ENV` unset) so local and CI behaviour is
  exactly what it is today — the status quo stays the default, and the *skip* is the opt-in.
- Then run `next build`.

`vercel.json` becomes:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "buildCommand": "node scripts/vercel-build.mjs",
  "installCommand": "npm install"
}
```

**Why a Node script rather than `sh vercel.sh`:** the repository is developed on Windows and
verified on Linux; Node is guaranteed on the builder, shell tooling is not. The Vercel
documentation explicitly allows a Node script for this ("The script can be written in Bash or
Node.js").

**Rejected alternatives:** a dashboard build-command override (invisible to review, and this
plan wants the rule in git); `ignoreCommand` (cancels builds, does not change what they run).

**Acceptance:** `node scripts/vercel-build.mjs` exits 0 locally with `VERCEL_ENV` unset and with
`VERCEL_ENV=preview`; `npm run build` is untouched and still passes.

### A2 · Declare the function-duration budget where it is consumed  → fixes F3, F4

- Add `export const maxDuration = 300` to the KDS SSE route, with a comment stating that 300 s is
  the platform default **and** the maximum on Hobby, that Pro/Enterprise may raise it to 800,
  and that the stream is therefore capped regardless.
- Document the consequence: the browser's `EventSource` reconnects automatically, but tickets
  created during the gap are not replayed (F4). Client-side backfill on reconnect is Phase 3.

**Not doing:** adding `preferredRegion`. It is a deployment-topology decision (which region the
database lives in) that belongs to the operator and to Phase 2's pooling work, not to a route
file. It is recorded in `OPERATIONS.md` as guidance instead.

### A3 · Redundant `runtime` exports → fixes F11

**Not doing.** `export const runtime = "nodejs"` is a no-op in Next 16 but it is also an explicit
statement of intent on the two routes that genuinely need Node APIs. Removing it is churn on two
files with no behavioural benefit. New routes simply will not add it.

### A4 · Prove the API is deployed  → fixes F10

Extend `scripts/verify-deployment.mjs` with API-surface probes that are safe to run against
production (no credentials, no writes):

| Probe | Expected | What it proves |
| :--- | :--- | :--- |
| `GET /api/v1/menu` | `200` + JSON | The Route Handlers are serving, not 404 |
| `GET /api/v1/orders` (no auth) | `401` | The route **exists** and auth is enforced (a missing route would be `404`) |
| `POST /api/v1/orders` (no auth, empty body) | `401` | Same, for the money path — and that auth is checked **before** parsing |

The distinguishing signal is `401` vs `404`; the verifier must never be given a real API key.

### A5 · Documentation

- `docs/OPERATIONS.md`: the deploy section describes the real build command and the
  production-only migration rule.
- `docs/ARCHITECTURE.md` + `docs/OPERATIONS.md`: state plainly that **the Express service is the
  self-host / local-dev runtime, and that no packaging for it exists in the repository yet**
  (F2). Target: container packaging is a Phase 6+ item.
- `docs/ROADMAP.md` §1.4 checkbox, `CHANGELOG.md`.

### A · Acceptance criteria

| # | Criterion | Evidence |
| :--- | :--- | :--- |
| A-1 | A preview deployment cannot run migrations | `scripts/vercel-build.mjs` logs "skipping migrations" under `VERCEL_ENV=preview` |
| A-2 | A production deployment still migrates | The script runs `prisma migrate deploy` when `VERCEL_ENV` is unset or `production` |
| A-3 | The API surface is verified after deploy | `npm run verify:prod` asserts the three probes above |
| A-4 | The KDS duration cap is explicit and documented | `maxDuration` export + `OPERATIONS.md` |
| A-5 | No doc claims container packaging that does not exist | `OPERATIONS.md`, `ARCHITECTURE.md` corrected |

---

## 7. Workstream B — money correctness (P1-7)

**Goal:** money is never a JavaScript float, and the tax rate is configuration, not a literal.

### B1 · A single money module

New `lib/money/index.ts` (with its own unit tests), implementing integer **minor units** (paise)
end to end:

| Export | Behaviour |
| :--- | :--- |
| `toMinorUnits(value)` | `Decimal \| string \| number` → integer minor units, rejecting non-finite input |
| `toDecimal(minorUnits)` | integer minor units → `Prisma.Decimal` for persistence |
| `applyRatePercent(minorUnits, percent)` | percentage → minor units, **half-up**, integer-only |
| `roundHalfUp(numerator, denominator)` | the one shared rounding primitive |

Everything else in the money path composes these. No `.toFixed()`, no `Math.round(x * 0.05)`.

### B2 · Put the rate in config, not in the money path  → fixes F5

New `config/pricing.ts`:

- `DEFAULT_TAX_RATE_PERCENT = 5` (the literal 5 lives here and nowhere else)
- `CURRENCY = "INR"`
- `resolveTaxRatePercent(tenant?)` → returns the configured default today, and carries a
  documented TODO pointing at Phase 2's `Tenant` column. The **call site is already correct**;
  only the data source is deferred.

### B3 · Rewrite the pricing block

`lib/services/orders.ts:190–226` is rewritten against B1: subtotal, coupon discount, loyalty
discount, taxable amount, tax and total are all integer minor units; each is rounded **once**,
half-up, at the point of definition, and converted to `Decimal` only when persisted. Business
rules (coupon validation, loyalty thresholds, the 100-points → ₹50 conversion) are unchanged.

### B4 · Tests

- New `tests/unit/money.test.ts`: half-up boundaries (`.005`), zero, large values, negative
  rejection, `Decimal`/string/number parity.
- Updated `tests/unit/orders.test.ts`: it asserts the current 5 %/float behaviour and **must**
  change with the code.
- New cases: 100 % coupon (tax on 0, not on the pre-discount subtotal), tip excluded from tax,
  discount capped at subtotal.

**Known behaviour delta:** because rounding now happens once per component in integer space
instead of in float space, a total can differ by **≤ 1 paise** from the current implementation.
This is the point of the change, and it is called out here so it is not mistaken for a
regression.

### B · Acceptance criteria

| # | Criterion | Evidence |
| :--- | :--- | :--- |
| B-1 | `0.05` appears exactly once in the codebase | `grep "0\.05"` → `config/pricing.ts` only |
| B-2 | No money value passes through a float | `lib/services/orders.ts` contains no `Number(...)` money arithmetic |
| B-3 | Rounding is half-up and once per component | `tests/unit/money.test.ts` boundary cases pass |
| B-4 | Stored values still satisfy `Decimal(10,2)` | Full suite green; Prisma accepts the values |

---

## 8. Workstream C — runtime parity

**Goal:** the claim "one codebase, two runtimes" is either true, or honestly restated.

### C1 · Extract the menu service

`server/api.ts` owns menu caching; the Next route does not. Extract the cached menu read into
`lib/services/menu.ts` and have both adapters call it, so the two runtimes cannot return
different menus. This is the pattern `lib/services/orders.ts` already sets.

### C2 · Decide what Express *is*  → **see §11, question D2**

Two honest options, and this plan does not pretend there is a third:

- **(a) Make the claim true.** Add a thin `POST /api/v1/orders` to the Express adapter that
  reuses `createOrder` and `lib/api/request-guards.ts`, so the parity test has a real subject.
- **(b) Make the claim smaller.** Declare the Express service "read paths, SSE and webhooks", and
  say so in `ARCHITECTURE.md`, `README.md` and `ROADMAP.md`.

Recommendation in §11.

### C3 · Align idempotency between runtimes  → fixes F9

The Express middleware runs **before** authentication, so it cannot scope a key by tenant. Rather
than move the middleware into individual routes, the plan is:

- Keep the global middleware for cheap early dedupe, but scope its key by
  `method + path + raw key` so the same key on two endpoints cannot collide (today it can).
- Perform the payload-fingerprint conflict check where the body is available — at the route
  level, reusing `hashPayload` from `lib/api/request-guards.ts`.
- The result is documented as: **the Next route is the reference implementation**; Express
  matches its observable behaviour (`201` replay, `409` duplicate, `409` key reuse).

### C4 · The parity smoke

New `tests/integration/two-runtime-parity.test.ts`:

- Call the Next Route Handler function directly with a constructed `Request`, and call the
  Express app in-process against an ephemeral port, with the same body and the same API key.
- Compare **status code + response body shape** (not headers, not field ordering).
- Cover: unauthenticated `401`; a valid order; a replayed `Idempotency-Key`; an invalid payload.

**Plumbing risk, called out now:** `server/api.ts` calls `app.listen(...)` at import time, so a
test cannot import it without opening a port. The plan therefore includes a small, safe refactor:
extract the Express `app` into `server/app.ts` and leave `server/api.ts` as the process entry
(`app.listen`). This is required for C4 and is otherwise behaviour-preserving.

### C · Acceptance criteria

| # | Criterion | Evidence |
| :--- | :--- | :--- |
| C-1 | Both runtimes return the same menu | Shared `lib/services/menu.ts`; parity test |
| C-2 | A replayed `Idempotency-Key` behaves identically on both runtimes | Parity test |
| C-3 | `server/api.ts` holds no business logic | Review: adapter + `app.listen` only |
| C-4 | `ARCHITECTURE.md` matches reality | Docs updated to whatever §11 D2 resolves to |

---

## 9. Test & gate matrix

| Workstream | New tests | Updated tests | Gates |
| :--- | :--- | :--- | :--- |
| **A** | — (the verifier is a script, exercised manually) | — | `tsc`, `eslint`, `vitest`, `next build`, link check, `node scripts/vercel-build.mjs` both branches |
| **B** | `tests/unit/money.test.ts` | `tests/unit/orders.test.ts` | as above + `grep "0\.05"` |
| **C** | `tests/integration/two-runtime-parity.test.ts` | `tests/unit/idempotency.test.ts` (new scoping) | as above |

Every commit must be green on: `npx tsc --noEmit`, `npm run lint`, `npm test`,
`npm run build`, and the documentation link checker.

---

## 10. Risks and rollback

| # | Risk | Likelihood | Mitigation |
| :--- | :--- | :--- | :--- |
| R1 | The build-command change breaks a deployment | Low | `npm run build` is untouched; the script defaults to today's behaviour when `VERCEL_ENV` is unset; it is exercised locally in both branches before commit |
| R2 | Preview deployments share the production database | Unknown — operator setting | A1 makes the failure impossible from the repository side, but **the environment variables must still be separated** (§11, D4) |
| R3 | Money refactor shifts a total by 1 paise | Certain (by design) | Documented delta; `money.test.ts` pins the rounding rule; seeded/demo data regenerates |
| R4 | The parity test cannot import the Express app | High (confirmed) | Extract `server/app.ts` first (C4 plumbing) |
| R5 | Setting `maxDuration` above the plan's cap | Low | The plan declares 300 s, which is legal on every plan |
| R6 | Scope creep into Phase 2's schema work | Medium | §3 fixes the boundary; F7 deliberately defers the tenant tax column |

**Rollback:** each workstream is a separate commit, and none of A/B/C is destructive. A revert of
any one commit restores the previous behaviour without a data migration.

---

## 11. Decisions — resolved

These were the open questions. **All four are now answered**, so this section records the
outcome rather than a proposal.

**D1 — Tenant-configurable tax: now or Phase 2?** → **Deferred to Phase 2** (owner, 2026-10-15).
`Tenant` has no tax field and `Setting` is global (F7), so a true per-tenant rate needs a schema
change — which is exactly what Phase 2 is for. Workstream B makes the *call site* correct and
configurable now (`config/pricing.ts`), so Phase 2 only has to add a column and a lookup.

**D2 — Does the Express runtime get `POST /api/v1/orders`?** → **Yes, add the thin endpoint**
(owner, 2026-10-15). A parity claim that is not tested is worse than no claim.

**D3 — Which Vercel plan?** → **Not yet confirmed.** `maxDuration` is declared at **300**, which
is legal on every plan. Raise it to 800 only after the plan is confirmed.

**D4 — Do preview deployments have their own database?** → **Operator action, not yet confirmed.**
A1 removes the accidental-migration risk from the repository; it cannot remove it from the
environment configuration. Verify in Vercel → Settings → Environment Variables before the first
preview deploy, and record it in `OPERATIONS.md`.

---

## 12. Commit sequencing

| Order | Workstream | Commit content |
| :--- | :--- | :--- |
| 1 | **A** | `scripts/vercel-build.mjs`, `vercel.json`, `maxDuration`, verifier probes, docs |
| 2 | **B** | `lib/money/`, `config/pricing.ts`, `lib/services/orders.ts`, tests |
| 3 | **C** | `lib/services/menu.ts`, `server/app.ts` extraction, guard alignment, parity test, docs |

One workstream per commit, each with all gates green, each with its documentation.

---

## 13. Progress log

Updated as work lands.

| Date | Workstream | State |
| :--- | :--- | :--- |
| 2026-10-15 | — | Plan written; awaiting review. Baseline `25b942d`. |
| 2026-10-15 | **A** (deployability) | ✅ Implemented. `scripts/vercel-build.mjs` + `vercel.json` (production-only migrations, verified with `--check`); `maxDuration` declared on both SSE routes and the notification stream's lifetime moved below the cap (`config/limits.ts`); four API-surface probes added to `scripts/verify-deployment.mjs` and verified against a real local production build; README API table corrected to the true route surface; new audit finding P1-10 recorded. |
| 2026-10-15 | **B** (money / P1-7) | ⬜ Not started. |
| 2026-10-15 | **C** (runtime parity) | ⬜ Not started. |

### Decisions taken during A (reviewable)

| Question | Decision | Why |
| :--- | :--- | :--- |
| How to branch the build command | A Node script (`scripts/vercel-build.mjs`), invoked from `vercel.json` | Works identically on the Windows dev machine and the Linux builder; the rule stays reviewable in git. Vercel documents both Bash and Node. |
| Default when `VERCEL_ENV` is unset | **Migrate** (status quo) | The skip is opt-in and explicit; local and CI behaviour is unchanged. |
| `maxDuration` value | `300` on both stream routes | Legal on every plan (Hobby's maximum). Raise to 800 only after the plan is confirmed — D3. |
| Scope of the SSE fix | Declare + document the cap | The missing `id:` replay is a Phase 3 concern (Redis-backed bus), not a route-file fix. |
| Extra docs work discovered mid-flight | Fixed | The README API table listed routes that do not exist and omitted the runtime split; the verifier's probes would have been written against a fiction. |
| D2 — Express `POST /api/v1/orders` | **Add it** (owner, 2026-10-15) | A parity claim that is not tested is worse than no claim. |
| D1 — tenant tax column | **Deferred to Phase 2** (owner, 2026-10-15) | Phase 2 owns schema work; B makes the call site configurable so only a column and a lookup remain. |

---

© 2026 Himanshu. All Rights Reserved.
