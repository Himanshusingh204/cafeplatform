# Spice & Saffron — Documentation

**Project:** Spice & Saffron — Indian Fine Dining & Café Platform
**Owner:** Himanshu ([@Himanshusingh204](https://github.com/Himanshusingh204))
**Last updated:** 2026-10-15

Welcome to the engineering documentation for **Spice & Saffron**, a multi-tenant
Indian café and restaurant commerce + operations platform. It is a single
Next.js 16 App Router codebase with an optional standalone Express API, backed by
PostgreSQL 18 via Prisma 7.

This `docs/` directory is the **authoritative engineering record**: the plan, the
architecture, the data model, the audit findings, the roadmap, the operational
runbook, the testing strategy, the performance budget, and the architecture
decision records (ADRs). Start with the table below, or jump to the path for your
role.

---

## Documents at a glance

| Document | What it covers | Who it is for |
| :--- | :--- | :--- |
| [MASTER_PLAN.md](./MASTER_PLAN.md) | The engineering master plan: current state, north-star principles, target architecture, capacity model, domain decomposition and cross-cutting concerns. | Owner, decision reviewer, new contributor |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System architecture: the two runtimes, the shared service layer, request flows, real-time bus and external integrations. | New contributor, decision reviewer |
| [DATABASE.md](./DATABASE.md) | Schema, relationships, indexing strategy, migration policy and tenant data model. | New contributor, on-call engineer |
| [AUDIT.md](./AUDIT.md) | Point-in-time audit of correctness, security, performance and debt, with evidence. | Reviewer, owner, on-call engineer |
| [ROADMAP.md](./ROADMAP.md) | The nine delivery phases and their exit criteria, from documentation and licensing through commercial readiness. | Owner, decision reviewer, new contributor |
| [OPERATIONS.md](./OPERATIONS.md) | The runbook: environments, deploy, migrations, monitoring, incident response and failure recovery. | On-call engineer, owner |
| [TESTING.md](./TESTING.md) | Test pyramid, tooling (Vitest 4, Playwright), fixtures, contract tests and quality gates. | New contributor, reviewer |
| [SEO-AND-PERFORMANCE.md](./SEO-AND-PERFORMANCE.md) | SEO strategy, performance budget and the image/metrics work required to hit it. | New contributor, reviewer |
| [adr/README.md](./adr/README.md) | What an ADR is, the status vocabulary, the template and the full index. | Everyone |
| [adr/0001](./adr/0001-vnext-route-handlers-as-primary-api.md) | Next.js Route Handlers are the primary production API; Express is retained for self-hosting. | Decision reviewer, new contributor |
| [adr/0002](./adr/0002-redis-as-required-production-dependency.md) | Redis becomes a required production dependency for cache, rate limiting, idempotency and pub/sub. | Decision reviewer, on-call engineer |
| [adr/0003](./adr/0003-durable-outbox-job-queue.md) | The in-process job queue is replaced by a durable database-backed outbox drained by a worker. | Decision reviewer, on-call engineer |
| [adr/0004](./adr/0004-tenant-isolation-not-null-and-rls.md) | Tenant isolation is enforced with `NOT NULL` tenancy, tenant-scoped keys and Row Level Security. | Decision reviewer, new contributor |
| [adr/0005](./adr/0005-decimal-money-and-integer-minor-units.md) | Money is decimal / integer minor units, computed server-side; never JavaScript floats. | Decision reviewer, reviewer |
| [adr/0006](./adr/0006-idempotency-persisted-not-in-memory.md) | Idempotency records are persisted and bound to payload + tenant, not held in a process map. | Decision reviewer, on-call engineer |
| [adr/0007](./adr/0007-object-storage-not-database-binary.md) | Uploaded binaries go to object storage, never into PostgreSQL. | Decision reviewer, on-call engineer |

---

## Start here

### If you are a new contributor

1. Read the repository [README.md](../README.md) for the product tour and setup.
2. Read [FILE_STRUCTURE.md](../FILE_STRUCTURE.md) for the directory map and
   conventions.
3. Read [ARCHITECTURE.md](./ARCHITECTURE.md), then the
   [ADRs](./adr/README.md) — they explain why the code looks the way it does.
4. Read [DATABASE.md](./DATABASE.md) and [TESTING.md](./TESTING.md) before you
   change the schema or the API.
5. Set up locally with [.env.example](../.env.example) and run the quality gates
   from [CONTRIBUTING.md](../CONTRIBUTING.md).

### If you are the on-call engineer

1. Keep [OPERATIONS.md](./OPERATIONS.md) open — it is the runbook.
2. Use [AUDIT.md](./AUDIT.md) to know which defects are known and open.
3. Read the ADRs that touch runtime state:
   [ADR-0002](./adr/0002-redis-as-required-production-dependency.md),
   [ADR-0003](./adr/0003-durable-outbox-job-queue.md),
   [ADR-0006](./adr/0006-idempotency-persisted-not-in-memory.md).
4. Report vulnerabilities per [SECURITY.md](../SECURITY.md) — never in a public
   issue.

### If you are reviewing a decision

1. Read [MASTER_PLAN.md](./MASTER_PLAN.md) and [ROADMAP.md](./ROADMAP.md) for the
   strategy and sequencing.
2. Read the ADR for the decision under review. Each ADR states the **Context**,
   the **Decision**, the **Consequences** and the **Alternatives considered**, so
   you can evaluate it without archaeology.
3. ADRs are immutable: to change a decision, propose a **new** ADR that
   supersedes the old one — see [adr/README.md](./adr/README.md).

---

## Documentation ownership and update rule

- **Docs change in the same pull request as the code they describe.** A PR that
  changes behaviour but not the affected document is incomplete.
- **Sibling docs stay consistent.** If a decision changes, add a new ADR and
  update the affected sections of [ARCHITECTURE.md](./ARCHITECTURE.md),
  [DATABASE.md](./DATABASE.md), [OPERATIONS.md](./OPERATIONS.md) and
  [ROADMAP.md](./ROADMAP.md) in the same PR.
- **Do not rewrite an Accepted ADR.** Supersede it. See the
  [ADR index](./adr/README.md) for the rule and the template.
- **Every document carries a `Last updated` date** and the current owner.
- **Keep claims verifiable.** Where a statement describes intent rather than
  shipped code, it is labelled "Target:" or "Not yet implemented".

---

## Root-level project documents

These live at the repository root and are not duplicated here.

| File | What it is | Who it is for |
| :--- | :--- | :--- |
| [README.md](../README.md) | Product overview, stack, quick start and the B2B/KDS gateway summary. | Everyone |
| [FILE_STRUCTURE.md](../FILE_STRUCTURE.md) | Exhaustive directory tree, architectural layers and coding conventions. | New contributor |
| [LICENSE](../LICENSE) | The proprietary, source-available license that governs all use. | Everyone |
| [SECURITY.md](../SECURITY.md) | Supported versions and the private vulnerability-reporting process. | On-call engineer, everyone |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | Development setup, quality gates and contribution terms. | New contributor |
| [CHANGELOG.md](../CHANGELOG.md) | Notable changes by version, following Keep a Changelog. | Everyone |
| [.env.example](../.env.example) | The environment-variable template with per-variable guidance. | New contributor, on-call engineer |

---

## Licensing

> **This project is proprietary and source-available — it is NOT open source.**

- **Personal, private, non-commercial use is permitted** (study, fork, modify,
  and self-host locally without generating revenue).
- **Any commercial use is prohibited** without a separate, prior, written
  commercial license. This includes company, agency, client, white-label,
  SaaS/hosted, franchise and internal business use.
- To obtain a commercial license, contact the owner:
  **himanshuyt21361@gmail.com** (GitHub:
  [@Himanshusingh204](https://github.com/Himanshusingh204)).
- The "Spice & Saffron" brand assets are reserved and are not licensed to you.

The full, binding terms are in [LICENSE](../LICENSE). The summary above is not
legally binding; the license text governs.

---

© 2026 Himanshu. All Rights Reserved.
