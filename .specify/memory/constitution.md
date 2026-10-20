<!--
Sync Impact Report
Version change: no prior constitution -> 1.0.0
Modified principles: none; established five new principles
Added sections: Core Principles, Domain and Technical Constraints, Development Workflow
Removed sections: none
Follow-up TODOs: RATIFICATION_DATE remains TODO because the original adoption date is unknown.
-->

# Banking API Constitution

## Core Principles

### I. Financial Correctness Is Non-Negotiable

All monetary values MUST use integer minor units with an explicit ISO-4217 currency;
floating-point arithmetic MUST NOT represent money. Every journal entry MUST balance
total debits and credits, ledger lines MUST be append-only, and corrections MUST use
reversal entries rather than history edits. The ledger is the source of truth; any
cached balance MUST be updated in the same database transaction as its ledger lines.
These rules make financial state exact, auditable, and recoverable.

### II. Safe Retries and Concurrency Are First-Class Requirements

Every money-moving request MUST be idempotent: the server MUST persist and validate an
idempotency key, request hash, and replayable result within the transaction that moves
money. Transfer processing MUST prevent double-spend through database-enforced
atomicity and locking or an equivalently proven concurrency control. Lock acquisition
order MUST be deterministic, and insufficient funds MUST be rejected before commit.
Concurrency tests MUST demonstrate that competing transfers cannot create an invalid
balance.

### III. Explicit Boundaries Enable the Roadmap

The monolith MUST be organized into modules with one owner for each table and clear
dependency direction. Domain policy belongs in the owning use-case module; accounting
invariants belong in the Ledger module; infrastructure access belongs behind explicit
adapters. Modules MUST communicate through stable contracts so that workers, events,
Kafka consumers, and eventually extracted services can replace in-process calls
without changing business invariants. Cross-module database foreign keys are allowed
only while the system is a monolith.

### IV. Verification, Testing, and Observability Prove Behavior

Every feature MUST have automated tests at the smallest useful level and integration
coverage for transaction boundaries, shared schemas, and module contracts. Financial
flows MUST be testable end to end through the documented API collection. Quality gates
MUST include linting, type-safe builds, and the test suite before a commit or release.
Production-relevant work MUST emit structured, privacy-safe logs and correlation
context sufficient to trace a request, background job, or event without logging
secrets, credentials, OTPs, or unnecessary personal data. Load tests MUST quantify
concurrency claims rather than relying on inspection.

### V. Incremental Delivery Must Preserve Reversibility

The project MUST advance in explicit phases: domain design, core monolith, delivery,
workers and queues, concurrency proof, domain events and transactional outbox, Kafka,
service extraction, and platform operations. Each phase MUST leave the preceding
invariants operational and documented before adding the next source of complexity.
New infrastructure MUST have a stated failure, retry, replay, or rollback behavior.
The simplest design that satisfies the current phase MUST be preferred, while
decisions that affect future extraction MUST be recorded with their trade-offs.

## Domain and Technical Constraints

- Amounts MUST be stored as PostgreSQL `BIGINT` minor units and serialized as strings
  at the API boundary; currencies MUST be stored with each monetary amount.
- Ledger accounts and journal lines MUST enforce double-entry, positive amounts,
  append-only history, and database-backed integrity constraints.
- Money-moving endpoints MUST require an `Idempotency-Key`; key reuse with a different
  request MUST fail, and an in-progress duplicate MUST be distinguishable from a
  completed replay.
- Customer and account records MUST be closed or suspended rather than deleted.
  Password hashes and OTP codes MUST be isolated from general customer data; raw OTPs
  MUST never be persisted.
- Authentication, authorization, KYC tier limits, account ownership, and transfer
  policy MUST be checked before ledger posting. Accounting invariants MUST remain
  enforced by the Ledger regardless of caller.
- Configuration and secrets MUST come from environment variables; `.env` files and
  credentials MUST NOT be committed. Dependencies MUST be declared explicitly and
  pinned according to the repository's engineering standards.
- Database migrations MUST be reviewed before application, and an applied migration
  MUST never be edited in place. Generated Prisma code MUST remain generated rather
  than hand-maintained.

## Development Workflow

1. A change MUST begin with a written statement of the domain behavior, invariants,
   failure modes, and affected module boundary.
2. Tests MUST be written or updated to express the behavior before implementation is
   considered complete. Changes to money movement MUST include rollback, retry, and
   concurrent-request coverage where applicable.
3. API and schema changes MUST update the relevant documentation and Postman
   collection. Event, queue, or service-contract changes MUST document delivery,
   ordering, retry, dead-letter, and replay semantics.
4. Pull requests MUST explain the invariant being protected, identify migrations and
   operational risks, and show passing `npm run lint`, `npm run build`, and `npm test`
   checks. A reviewer MUST reject a change that weakens financial correctness,
   idempotency, access control, or auditability without an explicitly approved
   constitutional amendment.
5. Commits MUST use Conventional Commits. Releases and deployments MUST be
   reproducible, secrets-free, and gated by the same automated checks used locally.
   Operational changes MUST include a rollback or recovery procedure.

## Governance

This constitution is the highest-level engineering policy for the Banking API.
When a design, implementation, or operational practice conflicts with it, the
constitution prevails unless it is amended first.

Amendments MUST be proposed in writing with the affected principles, rationale,
impact on existing work, migration or rollback plan, and updated documentation.
The change MUST be reviewed by the project owner before merge. A constitution
amendment MUST update the Sync Impact Report, version, and last-amended date, and
MUST NOT silently alter financial or security guarantees.

Versions follow semantic versioning:

- MAJOR increments for removing or redefining a principle in a backward-incompatible
  way.
- MINOR increments for adding a principle or materially expanding governance.
- PATCH increments for clarifications, wording, and non-semantic corrections.

Every pull request and release review MUST check compliance with this constitution,
including tests for affected invariants and documentation for changed contracts.
At each roadmap phase boundary, the project owner MUST review open risks, deferred
decisions, observability, and recovery procedures. Exceptions MUST be time-bounded,
documented with an owner and expiry condition, and tracked until resolved.

**Version**: 1.0.0 | **Ratified**: TODO(RATIFICATION_DATE): original adoption date is unknown | **Last Amended**: 2026-10-20
