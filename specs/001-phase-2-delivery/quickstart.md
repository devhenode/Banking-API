# Phase 2 Delivery Validation Guide

This guide validates the contracts in [contracts/delivery.md](./contracts/delivery.md)
without changing banking behavior.

## Prerequisites

- Docker Engine with Compose support
- Node.js version supported by the repository
- npm and a clean checkout
- A local `.env` containing the documented PostgreSQL and application settings

## Validate the production image

```bash
docker build -t banking-api:phase-2 .
docker image inspect banking-api:phase-2
```

Expected results:

- The image builds from a clean checkout.
- The image contains compiled runtime output and production dependencies.
- The configured container user is `node`, not root.

## Validate local orchestration

```bash
docker compose up -d --build
docker compose ps
curl --fail http://localhost:3000/health
docker compose logs --no-log-prefix api
```

Expected results:

- `postgres` reports healthy before `api` reaches normal startup.
- `GET /health` returns HTTP 200.
- API logs show migrations completing before the application process starts.
- Database connectivity uses the Compose service name.

Stop and restart without deleting the volume:

```bash
docker compose down
docker compose up -d
curl --fail http://localhost:3000/health
```

Expected result: local database state remains available.

## Validate migration failure behavior

Use a disposable test database or deliberately invalid migration configuration.
Start the API and verify:

- The migration command returns a non-zero result.
- The API process does not begin normal startup.
- Logs identify the migration failure without printing credentials.

Restore valid configuration before continuing.

## Validate the local quality gates

```bash
npm ci
npm run lint
npm run build
npx prisma migrate deploy
npm test
npm run test:e2e -- test/concurrent-transfers.e2e-spec.ts
```

Expected result: every command exits successfully against a reachable PostgreSQL
database. The focused e2e run must preserve the double-entry and no-double-spend
invariants.

## Validate CI behavior

Open a pull request or push a branch and confirm the workflow:

1. Creates an isolated PostgreSQL service.
2. Runs all required checks in the contract order.
3. Succeeds only when all checks pass.
4. Fails when a disposable test change breaks lint, build, migrations, unit tests,
   or concurrency tests.
5. Does not expose database credentials in logs.
