# ReelClue Deployment Checklist

## Prerequisites

1. **Database migrations applied**
   - All migrations in `supabase/migrations/` must be applied to target database
   - Verify RLS policies are active
   - Verify `consume_rate_limit` RPC exists (introduced in RC-022)

2. **Active catalog imported**
   - Run `pnpm catalog:sync --apply` on deployment environment
   - Verify active catalog exists:
     ```sql
     SELECT id, status, row_count, imported_at 
     FROM catalog_versions 
     WHERE status = 'active' 
     ORDER BY imported_at DESC 
     LIMIT 1;
     ```
   - Without active catalog, game creation returns 503 "Catalog is currently unavailable"

3. **Environment variables set**
   - `APP_BASE_URL` - deployment URL
   - `RATE_LIMIT_HASH_SECRET` - 64-char hex secret
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_SECRET_KEY` - service role key
   - `TMDB_API_KEY`
   - `TMDB_READ_ACCESS_TOKEN`

4. **Build verification**
   - `pnpm lint` passes
   - `pnpm typecheck` passes
   - `pnpm test` passes
   - `pnpm build` succeeds

## Post-Deployment Smoke Tests

1. **Player identity**: POST `/api/player` returns 201 with cookie
2. **Game creation**: POST `/api/games` with valid payload returns 201
3. **Health check**: GET `/api/health` returns 200 with catalog count > 0
4. **Rate limits**: Verify `consume_rate_limit` RPC works or gracefully falls back (RC-022 ponytail)

## Common Issues

### "Catalog is currently unavailable"
- Cause: No active catalog in `catalog_versions` table
- Fix: Run `pnpm catalog:sync --apply` on deployment database

### 503 on all routes
- Cause: `consume_rate_limit` RPC missing and fallback disabled
- Fix: Apply RC-022 migration `202611040007_rate_limits.sql`

### 401 on protected routes
- Cause: Player cookie not set or expired
- Fix: Verify `/api/player` POST sets cookie correctly

### CORS errors
- Cause: `APP_BASE_URL` mismatch or origin validation
- Fix: Set `APP_BASE_URL` to deployed domain

## Rollback Plan

1. Revert to previous deployment
2. Database migrations are forward-only; coordinate schema changes carefully
3. Catalog versions are immutable; no rollback needed for catalog data
