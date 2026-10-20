# Phase 2 Delivery Contracts

## Production Image Contract

- The image MUST build from the repository without requiring a host-installed
  application dependency tree.
- The final image MUST contain compiled `dist/` output, Prisma runtime artifacts,
  production dependencies, and the migration files required by the entrypoint.
- The final process MUST run as the non-root `node` user.
- The image MUST expose the configured HTTP port, defaulting to `3000`.
- The image command MUST execute the migration bootstrap before `node dist/main.js`.

## Health Contract

`GET /health`

- Authentication: none.
- Success: HTTP `200` with a small JSON body indicating the process is alive.
- Failure: the process is not considered ready until the container/runtime health
  check succeeds.
- The endpoint MUST NOT mutate data or expose credentials, account data, or
  migration secrets.

## Compose Contract

- Services: `api` and `postgres`.
- The API depends on PostgreSQL's successful health check, not merely container
  creation.
- The API's database URL uses `postgres` as the host inside the Compose network.
- PostgreSQL data uses a named persistent volume for normal local restarts.
- Host database port exposure is optional for local tooling, but API-to-database
  traffic MUST use the private service network.

## Migration Contract

- Startup executes the approved migration deployment command before launching the
  API process.
- A non-zero migration result MUST terminate startup with a non-zero exit status.
- A current schema MUST produce a successful no-op.
- No applied migration file may be edited or removed.

## CI Contract

Triggers:

- Every push.
- Every pull request.

Required checks, in order:

1. Install dependencies from the lockfile.
2. Run `npm run lint`.
3. Run `npm run build`.
4. Run `prisma migrate deploy` against the ephemeral PostgreSQL service.
5. Run `npm test`.
6. Run `npm run test:e2e -- test/concurrent-transfers.e2e-spec.ts` or the
   repository-equivalent focused command that selects the concurrency suite.

The workflow MUST fail if any check fails. Database credentials MUST be supplied
through workflow environment variables and MUST NOT be echoed.
