# Implementation Plan: Phase 2 Production Delivery

**Branch**: `001-phase-2-delivery` | **Date**: 2026-10-20 | **Spec**:
[spec.md](./spec.md)

**Input**: Feature specification from
`/specs/001-phase-2-delivery/spec.md`

## Summary

Deliver a reproducible Linux runtime for the compiled Banking API, orchestrate the
API and PostgreSQL locally with health-gated startup, apply approved migrations
before serving traffic, and enforce the Phase 1 quality gates on every push and
pull request. The design uses the repository's existing NestJS, Prisma, PostgreSQL,
Vitest, and Oxlint commands without introducing a new deployment platform.

## Technical Context

**Language/Version**: TypeScript 6 / Node.js 24-compatible runtime

**Primary Dependencies**: NestJS 12, Prisma 7.10.1, PostgreSQL 16 Alpine,
Docker Compose, GitHub Actions, Vitest 4, Oxlint

**Storage**: PostgreSQL 16 with existing Prisma migrations and a persistent local
Docker volume; disposable PostgreSQL service in CI

**Testing**: `npm run lint`, `npm run build`, `npm test`, and the e2e suite selected
through `vitest.config.e2e.ts`, including concurrent transfers

**Target Platform**: Linux containers on local Docker and generic cloud container
runtimes; GitHub-hosted Linux CI runners

**Project Type**: NestJS web service with a PostgreSQL database

**Performance Goals**: API service reaches a healthy state within 5 minutes of a
clean local start; migration startup adds no unnecessary work when the schema is
current

**Constraints**: Production runtime is non-root and excludes source and development
dependencies; API must not serve normally before migrations succeed; CI must not
leak secrets or share a persistent database

**Scale/Scope**: One API service and one PostgreSQL service; five required CI
quality checks; no provider-specific infrastructure or new business capability

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Financial Correctness**: PASS. The plan changes delivery and startup behavior
  only; it preserves the existing ledger, migration history, and financial tests.
- **Safe Retries and Concurrency**: PASS. CI explicitly runs the concurrent
  transfer suite, and startup migration execution is idempotent through the
  migration system's recorded state.
- **Explicit Boundaries**: PASS. Delivery artifacts are isolated to container,
  workflow, startup, and documentation boundaries; domain modules are unchanged.
- **Verification and Observability**: PASS. Lint, build, migrations, unit tests,
  e2e concurrency tests, health signaling, and failure visibility are required.
- **Incremental and Reversible Delivery**: PASS. The feature is limited to Phase 2,
  uses existing commands, documents startup failure and recovery, and leaves later
  workers/events/Kafka/service extraction out of scope.

No constitutional violations require complexity tracking.

## Project Structure

### Documentation (this feature)

```text
specs/001-phase-2-delivery/
├── plan.md
├── research.md
├── data-model.md
├── contracts/
│   └── delivery.md
├── quickstart.md
└── tasks.md                 # created by /speckit-tasks
```

### Source Code (repository root)

```text
Dockerfile                   # multi-stage production image
docker-compose.yml           # api + postgres local environment
docker-entrypoint.sh         # migrate-before-start bootstrap
.dockerignore                # runtime build context exclusions
.github/
└── workflows/
    └── ci.yml               # push and pull-request quality gate
package.json                # migration/startup script if retained here
README.md                   # delivery setup and recovery documentation
src/
└── main.ts                 # health signal wiring if required by the contract
prisma/
└── migrations/             # existing migrations; never edit applied files
test/
└── concurrent-transfers.e2e-spec.ts
```

**Structure Decision**: Keep the existing single NestJS service and Prisma
boundary. Add only repository-root delivery files, one CI workflow, and the
smallest runtime health/startup support required by the contracts. No new
application module or database model is needed.

## Phase 0: Research

Research decisions are recorded in [research.md](./research.md). The key choices
are to use a two-stage Node Alpine image, Compose health-gated dependency startup,
a fail-fast migration entrypoint, and one CI job with an ephemeral PostgreSQL
service and explicit sequential quality gates.

## Phase 1: Design

Design outputs:

- [data-model.md](./data-model.md) defines delivery state and ownership; it does
  not change the financial schema.
- [contracts/delivery.md](./contracts/delivery.md) defines the image, Compose,
  migration, health, and CI interfaces.
- [quickstart.md](./quickstart.md) provides runnable local and CI-equivalent
  validation scenarios.

## Complexity Tracking

No violations.
