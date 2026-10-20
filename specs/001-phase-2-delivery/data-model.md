# Phase 2 Delivery Data Model

This feature introduces delivery state, not new banking-domain records. Existing
Prisma models and migrations remain unchanged.

## Runtime Package

| Field | Description | Invariant |
|---|---|---|
| build source | Repository revision used by the builder | Must be reproducible from a clean checkout |
| compiled output | JavaScript required to start the service | Must be present in the runner |
| runtime dependencies | Packages required by the compiled service and Prisma | Development-only packages must be absent |
| runtime user | OS identity running the service | Must not be root |

## Local Service Environment

| Entity | Key attributes | Relationships and rules |
|---|---|---|
| API service | image, port, environment, health dependency | Depends on healthy PostgreSQL and shares the private network |
| PostgreSQL service | image, credentials, database name, health check | Owns persistent local volume; no API data ownership changes |
| Private network | internal service connectivity | API resolves database as `postgres`, not host `localhost` |
| Persistent volume | PostgreSQL data directory | Reused across normal local restarts |

## Migration Run

| State | Meaning | Allowed transition |
|---|---|---|
| pending | Approved migrations are not all applied | `pending -> applied` or `pending -> failed` |
| applied | Database matches the application migration history | No-op on repeat startup |
| failed | Migration command returned non-zero | Startup stops; operator fixes cause and retries |

Applied migration files are immutable. No destructive rollback migration is part of
this feature.

## Quality Gate Run

| Field | Description |
|---|---|
| trigger | Push or pull request |
| database | Ephemeral PostgreSQL instance for the run |
| checks | Lint, build, migration deploy, unit tests, concurrency e2e |
| result | Pass only when every required check passes |
| secret handling | Credentials come from workflow environment and are not logged |

The quality gate has no shared persistent state and is discarded after the run.
