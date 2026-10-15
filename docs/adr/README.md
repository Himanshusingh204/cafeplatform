# Architecture Decision Records (ADRs)

**Project:** Spice & Saffron — Indian Fine Dining & Café Platform
**Owner:** Himanshu ([@Himanshusingh204](https://github.com/Himanshusingh204))
**Last updated:** 2026-10-15

---

## What is an ADR?

An **Architecture Decision Record (ADR)** is a short, numbered document that
captures a single significant architectural decision together with its context,
its consequences, and the alternatives that were considered and rejected.

ADRs exist so that future maintainers can answer the question *"why is it built
this way?"* without re-reading the entire codebase or re-litigating a settled
debate. A good ADR:

- records **one** decision;
- states the context honestly, including the current defects that motivate it;
- labels clearly what is **decided** versus what is still a **target**;
- links to the concrete files and sibling documents that the decision touches.

ADRs live in `docs/adr/` and are referenced from the
[documentation index](../README.md).

---

## Status vocabulary

Every ADR carries exactly one status in its metadata block.

| Status | Meaning |
| :--- | :--- |
| **Proposed** | Written down and under discussion. Not yet binding. Code may not reflect it. |
| **Accepted** | Agreed and binding. Implementation may still be in progress — check each ADR's "Consequences" for the current state. |
| **Deprecated** | No longer recommended, but not yet replaced by a specific newer decision. |
| **Superseded** | Replaced by a newer ADR. The superseding record is linked in the metadata block. |

> **Rule:** A decision that changes is **not** edited in place. The old ADR keeps
> its text and is marked **Superseded**, and a **new** ADR is written that
> supersedes it. ADRs are immutable; the history of thinking is the value.

---

## Template

Copy this block into a new file named `NNNN-short-kebab-case-title.md`, with the
next free four-digit number.

```markdown
# ADR-000N: <Title>

| Field | Value |
| :--- | :--- |
| **Status** | Proposed |
| **Date** | YYYY-MM-DD |
| **Deciders** | Himanshu |
| **Supersedes** | _(none, or ADR-000X)_ |
| **Related** | _(link related ADRs / docs)_ |

## Context

What is the situation, constraint or defect that forces a decision? Reference
real files and line numbers. State what is true today, not what is hoped for.

## Decision

The decision, stated decisively in the present tense. Be specific enough that a
reviewer could tell whether code conforms. Label any not-yet-implemented part
with "Target:".

## Consequences

### Positive

### Negative

### Neutral

## Alternatives considered

For each alternative: what it is and the concrete reason it was rejected.

## References

- Source files with paths and line numbers.
- Links to sibling documents.
```

---

## Index

| ADR | Title | Status | Date |
| :--- | :--- | :--- | :--- |
| [ADR-0001](./0001-vnext-route-handlers-as-primary-api.md) | Next.js Route Handlers as the primary production API | Accepted | 2026-10-15 |
| [ADR-0002](./0002-redis-as-required-production-dependency.md) | Redis as a required production dependency | Accepted | 2026-10-15 |
| [ADR-0003](./0003-durable-outbox-job-queue.md) | Durable database-backed outbox job queue | Accepted | 2026-10-15 |
| [ADR-0004](./0004-tenant-isolation-not-null-and-rls.md) | Tenant isolation via `NOT NULL` tenancy and Row Level Security | Accepted | 2026-10-15 |
| [ADR-0005](./0005-decimal-money-and-integer-minor-units.md) | Decimal money and integer minor units | Accepted | 2026-10-15 |
| [ADR-0006](./0006-idempotency-persisted-not-in-memory.md) | Idempotency persisted and payload-bound, not in memory | Accepted | 2026-10-15 |
| [ADR-0007](./0007-object-storage-not-database-binary.md) | Object storage for binaries, never the database | Accepted | 2026-10-15 |

---

© 2026 Himanshu. All Rights Reserved.
