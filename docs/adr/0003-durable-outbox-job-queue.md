# ADR-0003: Durable database-backed outbox job queue

| Field | Value |
| :--- | :--- |
| **Status** | Accepted |
| **Date** | 2026-10-15 |
| **Deciders** | Himanshu |
| **Supersedes** | _(none)_ |
| **Related** | [ADR-0001](./0001-vnext-route-handlers-as-primary-api.md), [ADR-0002](./0002-redis-as-required-production-dependency.md) |

## Context

Background work — customer emails, outbound partner webhooks, and other
post-commit side effects — currently runs through an **in-process queue**:

- `lib/queue/job-queue.ts` holds jobs in a plain array (`lib/queue/job-queue.ts:26`)
  and drains them with `setInterval` (`lib/queue/job-queue.ts:83`), started from
  the constructor (`lib/queue/job-queue.ts:34-37`).
- A single module-level instance (`globalJobQueue`, `lib/queue/job-queue.ts:203`)
  is shared by Chromium-side callers and by `server/api.ts` (imported at
  `server/api.ts:14-15`).

Two properties of the target runtime make this unsafe:

1. **A serverless instance is frozen between requests.** The `setInterval`
   tick is not guaranteed to run; a job enqueued during a request may never be
   processed, or may be processed only if the process happens to stay warm. The
   worker "never drains reliably".
2. **In-process jobs are lost on every deploy and every cold start.** The array
   is memory; redeploying silently discards anything queued, which means
   **customer emails and outbound partner webhooks are dropped** with no record
   and no retry.

The queue already models retries, backoff (`lib/queue/job-queue.ts:124-136`) and
a dead-letter queue (`lib/queue/job-queue.ts:132-135`), but all of that state is
in memory and dies with the process.

## Decision

Replace the in-memory `setInterval` queue with a **durable database-backed
outbox**, drained by a **dedicated worker process**, with **Vercel Cron** for
scheduled work.

- Side effects that must happen after a transaction — the outbound webhook and
  the notification email — are written as **outbox rows in the same database
  transaction as the order**. The row commits atomically with the business
  change; it cannot be lost.
- A **separate worker process** (the retained Express host from
  [ADR-0001](./0001-vnext-route-handlers-as-primary-api.md), or an equivalent
  long-lived process) polls and drains the outbox with lease/lock semantics,
  retries with backoff, and moves exhausted jobs to a dead-letter state that is
  itself durable.
- **Vercel Cron** drives time-scheduled work (for example periodic sweeps and
  digest sends) by invoking a small endpoint; it does not replace the outbox.
- **Not yet implemented:** the outbox table, the worker, and the Cron entries are
  a target for the Phase 3 (Stateless runtime) and Phase 7 (Observability &
  operations) work in [`../ROADMAP.md`](../ROADMAP.md).

## Consequences

### Positive

- **Transactional correctness:** because the outbox row commits with the order,
  "order created" and "webhook scheduled" can never disagree. At-least-once
  delivery becomes achievable without distributed transactions.
- Jobs survive deploys, cold starts and crashes; nothing is silently dropped.
- Failure is observable: pending, stuck and dead-lettered jobs are queryable
  rows, not a `console.error`.
- The worker can be run to completion and scaled independently of web traffic.

### Negative

- New schema (an outbox table), a new worker process to run and monitor, and
  handler code that must be **idempotent** to tolerate at-least-once delivery.
- More operational surface: the worker needs alerting on queue depth and
  dead-letter growth (see [`../OPERATIONS.md`](../OPERATIONS.md)).
- Vercel Cron has platform limits on frequency and invocation duration that must
  be respected when scheduling work.

### Neutral

- The `JobQueue` class and its metrics interface can be retained as the in-process
  implementation for local development and tests, mirroring the Redis policy in
  [ADR-0002](./0002-redis-as-required-production-dependency.md).
- The event names (`enqueued`, `completed`, `retry`, `dlq`) can be preserved to
  keep existing tests meaningful.

## Alternatives considered

- **Upstash QStash (or another managed queue).** Rejected as the primary
  mechanism: it adds a vendor, and it still requires the outbox pattern for
  transactional correctness (you must write the intent to send in the same
  transaction as the order regardless of who later delivers it). QStash may be
  used as a delivery transport on top of the outbox, but it is not a substitute
  for it.
- **Pure Redis lists as the queue.** Rejected: **Redis is a cache, not a system
  of record.** A job enqueued only in Redis is lost if Redis is flushed or the
  write is not transactional with the order. The outbox row must commit
  atomically with the business change, which Redis cannot participate in.
- **Keep the in-memory queue and run a single always-on instance.** Rejected: it
  caps scale, still loses jobs on deploy, and contradicts the serverless target.
- **Fire side effects inline in the request and rely on HTTP retries.** Rejected:
  it couples customer latency to third-party availability and still loses work
  when the request has already committed.

## References

- `lib/queue/job-queue.ts` (in-memory array at line 26, `setInterval` at line 83,
  constructor start at lines 34-37, DLQ at lines 132-135, singleton at line 203)
- `lib/queue/handlers.ts` (registered job handlers)
- `server/api.ts` (imports the queue at lines 14-15)
- `lib/services/orders.ts` (side effects after `createOrder`, lines 251-300)
- `lib/webhooks/dispatcher.ts` (outbound webhook dispatch)
- [`../OPERATIONS.md`](../OPERATIONS.md), [`../ROADMAP.md`](../ROADMAP.md)
- [`../adr/README.md`](./README.md)
