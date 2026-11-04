# RC-004 — database foundations and validation

4 November 2026. Branch `feat/rc-004-database-schema` from `4ed65db` (merged RC-003). RC-002 dependency already merged. Backend only; no UI change or screenshots required.

## Schema and boundaries

`supabase/migrations/202611040001_foundations.sql` creates all eight PRD entities: catalog versions, movies, anonymous players, sessions, rounds, actions, guesses and rate-limit buckets. UUID identities; SHA-256-shaped token/request hashes; one active catalog; unique player/create-action, session/ordinal and session/movie; wrong-text/identity deduplication; bounded attempts/hints/score/revision. Composite FKs prevent cross-catalog round movies and cross-session action references. JSON fields enforce container shape, not future provider/DTO schemas.

All tables enable RLS with no browser policies. Explicit table and function grants exclude `PUBLIC`, `anon`, `authenticated`; only `service_role` gets application operations. Both RPCs use `SECURITY INVOKER` and explicit `search_path = pg_catalog`. Future functions created by the same migration role lose default PUBLIC execution globally and schema-specific browser grants. Other migration authors must explicitly revoke/grant their own functions too.

`catalog_coverage()` returns version/rules/status, movie totals and tier/mode counts without titles or aliases. No activation/import logic yet. `purge_expired()` atomically:

- Marks active sessions expired at their expiry time, advancing revision once.
- Removes actions/guesses after seven days; incomplete sessions seven days after creation; completed sessions thirty days after completion. Cascades child rounds/actions/guesses.
- Removes expired player identities only when no retained session references them. Hash remains while FK requires it, but expiry remains authoritative for authentication.
- Removes only unreferenced **retired** catalogs; active, staging and every still-referenced version remain. Completed results conservatively retain catalog references until result purge; `reveal_snapshot` allows future minimal terminal snapshots.
- Removes at most 10,000 expired rate-limit buckets per call. Repeat calls drain larger backlogs. No cron configured.

Gameplay transitions, cookie issuance, transaction/idempotency replay, answer judging, DTO validation and catalog quality/activation belong to RC-006–RC-009. Constraints here do not claim to enforce a complete ten-round transaction or validate snapshot safety. Every future server route must check cookie ownership before using the privileged client; RLS does not protect against an incorrectly authorized server.

## Isolated tests

Prerequisite: running Docker engine with Linux containers. Run:

```bash
pnpm install --frozen-lockfile
pnpm test:db
```

Harness uses only a newly named `reelclue-test-<uuid>` container, pinned official PostgreSQL 17 image digest, `--network none`, no published ports, and database `reelclue_isolated_test`. No URL argument, `.env.local`, remote database, host DB or Supabase credentials used. Local trust auth exists only inside this disconnected test container. Harness creates vanilla-PostgreSQL shims for Supabase's three API roles, applies ordered migrations to empty DB, loads explicitly fictional fixtures, prints coverage and runs SQL assertions. Fixture seed refuses other database names. Container and its volumes are removed in `finally`; image remains cached. No public seed endpoint or production seed command exists.

CI runs the same `pnpm test:db` on hosted Ubuntu Docker, without secrets. This tests real PostgreSQL constraints/permissions, **not** hosted Supabase's API gateway/PostgREST or provisioning. Hosted-project apply/HTTP smoke checks remain owner-controlled follow-up; no claim made that Supabase is deployed.

## Owner-controlled migration and cleanup

Apply the versioned migration with Supabase's migration tooling or SQL editor to an explicitly selected development/staging project first. Roles `anon`, `authenticated`, `service_role` must already exist (normal Supabase projects supply them). Do not run test fixtures on hosted projects. This ticket did not apply migrations to any owner project.

Server client is lazy and marked `server-only`; requires HTTP(S) `SUPABASE_URL` plus `SUPABASE_SECRET_KEY`. Explicit legacy `SUPABASE_SERVICE_ROLE_KEY` fallback accepts service-role JWT class, never anon/publishable keys. Key class inspection is not signature verification; Supabase verifies the credential. Auth persistence, refresh and URL session detection are disabled. No browser Supabase client, public key or public catalog route added.

The following command permanently deletes records under the retention rules above. Confirm `.env.local` points to the intended project and take any required backup before running it. Never paste credentials into command arguments or logs.

```bash
pnpm db:purge --apply
```

Command loads ignored `.env.local`, uses Node 22's native TypeScript stripping and `react-server` condition for the existing server-only guard, then invokes one RPC. Without exact `--apply`, it refuses to run. Reports aggregate counts only; raw SDK/provider errors are suppressed. No scheduler enabled.

## Validation evidence

- `pnpm lint`: passed, zero warnings.
- `pnpm typecheck`: passed, strict TypeScript and generated Next.js route types.
- `pnpm test`: passed, 3 files / 19 tests. Four DB unit checks cover env validation/redacted errors, legacy versus anon key class, explicit purge confirmation guard, lazy stateless client and server-only guards.
- `pnpm test:db`: passed on isolated PostgreSQL 17. All migrations applied to empty DB; four fixture versions each report two fictional movies and two eligible modes. Tests cover FK/check/uniqueness, actual denied reads/deletes and RPC calls under both browser roles, RLS fallback after temporary SELECT/INSERT grants, default future-RPC execution denial, server coverage access, retention boundaries/cascades, protected active/staging/referenced catalogs, eventual final-reference cleanup and repeated purge.
- `pnpm build`: passed; existing static UI routes unchanged, no credentials required.

Initial future-RPC assertion caught PostgreSQL's global PUBLIC EXECUTE default surviving schema-only revoke; migration now revokes global default too. Explicit grants on test-only assertion helpers keep role-switch tests valid. First image download exceeded initial harness timeout; image cached and harness timeout raised to ten minutes. Repeated fresh-container test caught readiness against PostgreSQL's temporary initialization socket; harness now waits for final TCP listener inside the disconnected container. Two consecutive final isolated runs passed; no production writes occurred.

## Review steps

1. Review migration FK/delete behavior, grants, RLS and two invoker functions. Confirm scope excludes gameplay engine and public routes.
2. Start Docker, run `pnpm test:db`; check coverage output and final PASS. Confirm `docker ps -a --filter name=reelclue-test-` shows no leftover harness containers.
3. Run lint, typecheck, tests and build. Review `.env.example` placeholders, server-only module boundaries and cleanup command's explicit confirmation guard.
4. Approve/adjust retention interpretation and constraints before authorizing merge. Do not run `db:purge --apply` against production as a review step.
