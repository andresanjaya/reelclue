# ReelClue Deployment Checklist

Comprehensive release runbook: [`docs/RC-024-RELEASE-RUNBOOK.md`](./RC-024-RELEASE-RUNBOOK.md).

## Prerequisites

1. **Pre-flight verification passed**:
   - Run `pnpm verify:deployment` to validate environment, database RPCs, and catalog versioning automatically.

2. **Database migrations applied**:
   - All migrations in `supabase/migrations/` (001 to 007) must be applied to target database
   - Verify RLS policies are active
   - Verify `consume_rate_limit` RPC exists (`202611040007_rate_limits.sql`)
   - Verify `purge_expired` RPC exists

3. **Active catalog imported**:
   - Run `pnpm catalog:sync --apply` on deployment environment
   - Verify active catalog exists:
     ```sql
     SELECT id, status, imported_at, summary->>'approved' as movie_count 
     FROM catalog_versions 
     WHERE status = 'active' 
     ORDER BY imported_at DESC 
     LIMIT 1;
     ```
   - Without active catalog, game creation returns 503 "Catalog is currently unavailable"

4. **Environment variables set (Server-only)**:
   - `APP_BASE_URL` - deployment URL (e.g. `https://reelclue.vercel.app`)
   - `SUPABASE_URL` - Supabase project URL
   - `SUPABASE_SECRET_KEY` - privileged service role key (never expose to browser)
   - `TMDB_READ_ACCESS_TOKEN` - server-only Bearer token
   - `RATE_LIMIT_SECRET` - 64-char hex HMAC secret

5. **Build & Test verification**:
   - `pnpm lint` passes
   - `pnpm typecheck` passes
   - `pnpm test` passes
   - `pnpm build` succeeds

## Post-Deployment Smoke Tests

1. **Player identity**: POST `/api/player` returns 201 with `reelclue_player` cookie
2. **Game creation**: POST `/api/games` with valid payload returns 201
3. **Health check**: GET `/api/health` returns 200 with catalog count > 0
4. **Rate limits**: Verify `consume_rate_limit` RPC works. Missing RPC returns 503; never bypass limits.
5. **Poster pipeline**: GET `/api/games/[id]/rounds/[roundId]/poster` returns transformed image bytes without source path.
6. **Mobile UX**: 44px min touch targets, no horizontal overflow.

## Common Issues

### "Catalog is currently unavailable"
- Cause: No active catalog in `catalog_versions` table
- Fix: Run `pnpm catalog:sync --apply` on deployment database

### 503 on all routes
- Cause: `consume_rate_limit` RPC missing
- Fix: Apply RC-022 migration `202611040007_rate_limits.sql`

### 401 on protected routes
- Cause: Player cookie not set or expired
- Fix: Verify `/api/player` POST sets cookie correctly

### CORS errors
- Cause: `APP_BASE_URL` mismatch or origin validation
- Fix: Set `APP_BASE_URL` to deployed domain

## Rollback Plan

See [Section 10 of Release Runbook](./RC-024-RELEASE-RUNBOOK.md#10-non-destructive-rollback-procedures) for full non-destructive rollback steps:
1. **Application rollback**: Revert to previous Vercel deployment hash in $<10\text{ seconds}$.
2. **Catalog rollback**: Re-activate previous catalog version via `SELECT activate_catalog('<previous-uuid>');`. Live sessions and historical results are preserved.
3. **Database migrations**: Forward-only; coordinate schema updates additively.
