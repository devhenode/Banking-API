# Phase 2 Production Delivery Research

## Decision: Use a two-stage Node Alpine production image

**Rationale:** A builder stage can install development dependencies, generate the
Prisma client, and compile `dist/`; a separate runner stage can install or copy
only production dependencies and run as the non-root `node` user. This keeps the
runtime deterministic and limits the attack surface.

**Alternatives considered:** A single image was rejected because it retains
compilers, source files, and development dependencies. A distroless image was
deferred because Prisma's runtime behavior and operational debugging need to be
validated first.

## Decision: Use Compose health-gated startup

**Rationale:** PostgreSQL readiness is stronger than process creation. A
`pg_isready` health check plus `depends_on` with the healthy condition makes API
startup deterministic while an internal service name keeps database traffic on the
private Compose network.

**Alternatives considered:** A fixed sleep was rejected because startup time is
variable. Host networking was rejected because it does not model deployment
isolation and makes `localhost` configuration misleading.

## Decision: Run migrations in a fail-fast startup entrypoint

**Rationale:** The migration command runs before the API process and inherits its
exit status. If migration application fails, the API process is never launched.
When the database is current, the operation is a no-op; the migration history
remains the source of truth.

**Alternatives considered:** Running migrations asynchronously after API startup
was rejected because requests could reach an incompatible schema. Manual operator
migrations were rejected because they are not reproducible or safely gated.

## Decision: Run CI checks against an ephemeral PostgreSQL service

**Rationale:** GitHub-hosted runners provide isolated jobs, and a service
container supplies a clean database for each run. The workflow can apply
migrations before tests and execute the existing repository commands without
relying on a developer machine or a shared database.

**Alternatives considered:** A shared remote database was rejected because it
creates cross-run coupling and risks data leakage. Containerizing the entire CI
job was deferred because the required quality checks can run directly on the
runner while PostgreSQL remains isolated.

## Decision: Treat `/health` as the delivery health contract

**Rationale:** A small unauthenticated liveness endpoint gives Compose, cloud
platforms, and operators a stable process-level signal without exposing business
data. Database readiness remains represented by Compose dependency health and
migration startup rather than by making the liveness endpoint perform financial
queries.

**Alternatives considered:** Using an arbitrary business endpoint was rejected
because it requires authentication and can mutate or depend on domain state.
Adding a full dependency health framework was deferred until the observability
phase.
