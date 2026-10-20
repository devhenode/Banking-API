# Feature Specification: Phase 2 Production Delivery

**Feature Branch**: `001-phase-2-delivery`

**Created**: 2026-10-20

**Status**: Draft

**Input**: User description: "Deliver the Banking API through production-ready
containerization, local multi-service orchestration, automated database migration
startup, and a CI/CD quality gate."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Run the API as a deployable package (Priority: P1)

As an operator, I want a deterministic production package that contains only what
is needed to run the compiled API, so the service behaves consistently on a
developer machine, in CI, and on a cloud host.

**Why this priority**: A reproducible runtime is the foundation for every later
deployment and reduces the risk of environment-specific financial failures.

**Independent Test**: Build the production package, start it with a configured
database, and verify that the API becomes healthy without development-only tools or
source files in the runtime package.

**Acceptance Scenarios**:

1. **Given** a clean checkout, **when** the production package is built,
   **then** the build completes without requiring host-installed application
   dependencies beyond the documented build prerequisites.
2. **Given** the production package is inspected, **when** its runtime contents are
   reviewed, **then** compiled application output and production dependencies are
   present while source TypeScript and development-only dependencies are absent.
3. **Given** the package is started as its non-root runtime user, **when** the
   health endpoint is requested after startup, **then** the API responds
   successfully.

---

### User Story 2 - Start the complete local environment (Priority: P1)

As a developer or operator, I want the API and its database to start together on
an isolated internal network, so local verification matches deployment topology
and the API does not race an unavailable database.

**Why this priority**: Reliable service startup prevents misleading failures and
makes database-dependent tests repeatable.

**Independent Test**: Start the documented local environment from a clean state,
wait for the database health signal, and verify API connectivity using the internal
service name rather than a host-local address.

**Acceptance Scenarios**:

1. **Given** the local environment is stopped, **when** the operator starts the
   documented services, **then** both the API and database are created on the same
   private application network.
2. **Given** the database is still starting, **when** the API service is scheduled,
   **then** the API waits for the database health condition before attempting normal
   startup.
3. **Given** both services are healthy, **when** the API handles a database-backed
   request, **then** it connects through the database service name and returns the
   expected result.
4. **Given** the environment is stopped and started again, **when** persistent
   database storage is reused, **then** existing local data remains available.

---

### User Story 3 - Gate changes with automated quality checks (Priority: P1)

As a maintainer, I want every push and pull request checked automatically, so
merges cannot introduce compilation, migration, unit-test, or concurrency
regressions.

**Why this priority**: The quality gate protects the financial invariants already
proven in Phase 1 and provides a repeatable release signal.

**Independent Test**: Trigger the workflow with passing and intentionally failing
changes, then verify that all required checks run and that any failed check makes
the workflow fail.

**Acceptance Scenarios**:

1. **Given** a push or pull request is created, **when** the workflow starts,
   **then** it runs lint validation, compilation validation, migration validation,
   the full unit-test suite, and the concurrent-transfer end-to-end test.
2. **Given** every required check passes against an ephemeral database,
   **when** the workflow completes, **then** it reports success and exposes a
   successful merge gate.
3. **Given** any required check fails, **when** the workflow completes, **then**
   it reports failure and the change is not eligible for merging through the
   configured gate.
4. **Given** the workflow finishes, **when** temporary database resources are
   inspected, **then** they are isolated to the workflow run and do not depend on
   a shared persistent environment.

---

### User Story 4 - Apply database changes before serving traffic (Priority: P1)

As an operator, I want pending database migrations applied before the API accepts
normal traffic, so application code never runs against an incompatible schema.

**Why this priority**: Schema ordering is a deployment safety requirement; serving
requests before migrations complete can corrupt or interrupt financial workflows.

**Independent Test**: Start the service against a database with pending migrations
and verify migration completion before the API process is launched.

**Acceptance Scenarios**:

1. **Given** the database is reachable and has pending migrations, **when** the API
   starts, **then** all approved migrations are applied before normal API startup.
2. **Given** migration application fails, **when** startup continues, **then** the
   API does not serve normal traffic and exposes a clear failure status.
3. **Given** the database is already current, **when** the API starts, **then** the
   migration step completes safely without changing applied migration history.
4. **Given** the startup migration step is retried, **when** it encounters a
   partially completed prior attempt, **then** it uses the migration system's
   recorded state and does not apply a migration twice.

### Edge Cases

- The database health check must fail when the database process is running but not
  accepting authenticated connections.
- API startup must fail clearly when the required database configuration is absent
  or points to an unreachable host.
- A failed migration must not be hidden by a later successful-looking API process.
- A production build must not depend on development-only environment files or
  credentials.
- CI must fail if a migration is invalid, if the database cannot be reached, or if
  the concurrency test detects an invariant violation.
- Repeated local starts must not create duplicate database resources or discard
  persistent local data.
- Workflow steps must not print database credentials or other secrets in logs.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The project MUST produce a deterministic production runtime package
  from a clean checkout.
- **FR-002**: The production runtime package MUST contain compiled application
  output and only the dependencies required for normal service execution.
- **FR-003**: The production service MUST run as a non-root user and expose a
  documented health signal.
- **FR-004**: The local delivery environment MUST provide both the API service and
  PostgreSQL service on an isolated private network.
- **FR-005**: The local delivery environment MUST provide a database health check
  and MUST prevent normal API startup until that health check succeeds.
- **FR-006**: The API MUST resolve the local database through the database
  service name and MUST preserve database data through normal environment restarts.
- **FR-007**: The project MUST provide an automated startup step that applies all
  approved database migrations before launching the API process.
- **FR-008**: The startup step MUST stop normal API startup and report a clear
  failure when migration application fails.
- **FR-009**: Automated validation MUST run for every push and pull request.
- **FR-010**: Automated validation MUST include linting, compilation, migration
  application against an ephemeral PostgreSQL instance, the complete unit-test
  suite, and the concurrent-transfer end-to-end test.
- **FR-011**: A failed required validation MUST fail the workflow and prevent the
  associated change from satisfying the merge quality gate.
- **FR-012**: CI database resources MUST be isolated per workflow run and all
  credentials MUST be supplied through protected workflow configuration rather
  than committed files.
- **FR-013**: Delivery documentation MUST describe local startup, required
  configuration, health checks, migration behavior, validation commands, and
  recovery behavior for failed startup.
- **FR-014**: The delivery changes MUST preserve Phase 1 financial invariants,
  including double-entry balance, idempotency, append-only ledger history, and
  concurrency-safe transfers.

### Key Entities *(include if feature involves data)*

- **Production Runtime Package**: The versioned deployable output containing the
  compiled API and its runtime dependencies.
- **Local Service Environment**: The API and database services, their private
  network, health conditions, and persistent local storage.
- **Migration Run**: An ordered attempt to bring the database schema to the
  approved application version, with success or failure state.
- **Quality Gate Run**: A push or pull-request validation run containing the
  required checks and an overall pass/fail result.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A clean checkout can produce and start the production runtime package
  using only the documented prerequisites in 5 minutes or less on a standard
  developer workstation.
- **SC-002**: In 10 consecutive clean local starts, the API reaches its healthy
  state without a database race or manual retry after the database reports healthy.
- **SC-003**: 100% of pushes and pull requests receive all five required quality
  checks before the workflow is marked successful.
- **SC-004**: 100% of intentionally failing lint, compilation, migration, unit-test,
  and concurrency-test changes produce a failed quality gate.
- **SC-005**: In 10 startup trials with pending migrations, the API serves no normal
  traffic until migration completion is reported.
- **SC-006**: In 10 startup trials with a forced migration failure, the API remains
  unavailable and the failure is visible in the startup result.
- **SC-007**: A successful Phase 2 delivery run leaves all existing Phase 1
  automated tests passing, including the concurrent-transfer scenario.
- **SC-008**: A reviewer can reproduce local startup and every CI quality check
  from the delivery documentation without relying on undocumented host state.

## Assumptions

- The Phase 1 API, database schema, migration history, and automated tests are the
  baseline and are already passing before Phase 2 work begins.
- PostgreSQL is the only required stateful service in this phase.
- The initial deployment target is a generic Linux container runtime; provider-
  specific cloud deployment configuration is outside this feature.
- Local database persistence is required for developer convenience, while CI
  databases are disposable and isolated per run.
- CI secrets and repository merge protection can be configured by the repository
  maintainer outside the application source.
- The existing documented environment variables remain the source of truth for
  database and authentication configuration.
- Rollback of application releases is handled by the deployment platform; this
  feature documents migration failure behavior but does not introduce destructive
  schema rollback migrations.

## Out of Scope

- Cloud-provider-specific infrastructure, production domains, certificates, and
  autoscaling.
- A second database engine or a managed database provisioning workflow.
- New customer, account, ledger, transfer, or KYC business capabilities.
- Background workers, queues, domain events, Kafka, microservice extraction, and
  Kubernetes operations reserved for later roadmap phases.
