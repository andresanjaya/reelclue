# RC-008 — Anonymous Game Lifecycle and Atomic Actions

4 November 2026. Branch `feat/rc-008-game-lifecycle` from `8dcb43e` after RC-007 merged. Game lifecycle service, domain logic, safe serialization, App Router endpoints, and database integration tests.

## Outcome

Create, resume and advance one authoritative ten-round game under anonymous cookie identity, strict transactional idempotency, and leak-proof DTO serialization.

## Architecture and Components

### 1. Anonymous Browser Identity (`/api/player`)
- Cryptographically random 256-bit token issued via `crypto.randomBytes(32).toString("hex")`.
- Database stores only SHA-256 hash `token_hash` in `public.anonymous_players` table.
- Browser receives `reelclue_player` in `HttpOnly`, `SameSite=Lax`, `Secure` in production, `path=/`, `maxAge=30 days`.
- Response JSON returns `{ ok: true }` and never leaks plaintext tokens or hashes in response bodies.

### 2. Ten-Round Movie Selection (`src/lib/server/game/selection.ts`)
- Single mode: selects 10 distinct eligible movies for the chosen mode and tier (`easy`, `medium`, `hard`).
  - History exclusion: excludes recent movie IDs (bounded to last 30).
  - Shortage handling: relaxes recent exclusion if pool < 10. If pool still has < 10 movies, returns typed `CATALOG_SHORTAGE` error (`400 Bad Request`).
- Mixed mode: exactly 2 rounds per mode across all 5 modes (`poster`, `title`, `synopsis`, `cast`, `genre`).
  - Evaluates modes sorted by most constrained eligibility pool first.
  - Bounded deterministic backtracking solver (max 100 attempts).
  - Relaxes recent exclusion before declaring catalog shortage.
  - Generates 10 complete game rounds with unique seeded random UUIDs (`reveal_seed`).

### 3. Progressive Nested Clues & Leak Prevention (`src/lib/server/game/clues.ts` & `src/lib/server/game/dto.ts`)
- **Missing Title**:
  - Grapheme segmentation via `Intl.Segmenter`.
  - Letters/digits masked with `_`; whitespace and punctuation preserved.
  - Deterministic reveal fractions: 35% (Stage 0), 50% (Stage 1), 65% (Stage 2), 80% (Stage 3).
  - Strictly nested reveal: indices revealed at stage $k$ remain revealed at stage $k+1$.
  - Never reveals 100% of the title (at least one maskable letter remains masked).
- **Poster**:
  - Stages 0–2: opaque poster route `/api/games/{id}/rounds/{roundId}/poster` with no year or genre.
  - Stage 3: poster URL + release year + primary genre. Clear original poster never leaked.
- **Synopsis**:
  - Stage 0: sanitized synopsis clipped at sentence/word boundary (<= 600 chars).
  - Stage 1: + release decade.
  - Stage 2: + primary genre.
  - Stage 3: + primary director.
- **Cast**:
  - Stage 0: director.
  - Stage 1: + 1st billed cast member.
  - Stage 2: + 2nd billed cast member.
  - Stage 3: + 3rd billed cast member + release year.
- **Genre Detective**:
  - Stage 0: up to 3 genres + release decade.
  - Stage 1: + original language.
  - Stage 2: + director.
  - Stage 3: + lead actor + exact release year.
- **Active DTO Security**:
  - Active round DTO NEVER serializes `movie_id`, `tmdb_id` (unless terminal), `approved_aliases`, or future rounds.
  - Unreached future rounds are completely omitted from responses.
  - `Cache-Control: no-store, private` set on all game responses.

### 4. Transactional Action Envelope (`supabase/migrations/202611040004_game_lifecycle.sql`)
- `create_game_session`:
  - Enforces atomic creation of session and 10 rounds.
  - Idempotent on `(player_id, creation_action_id)`. Re-submitting identical payload returns same session without duplicate writes. Re-submitting different payload with same action ID raises `40901` (`PAYLOAD_MISMATCH`).
- `apply_game_action`:
  - Locks session row (`FOR UPDATE`) and active round row (`FOR UPDATE`).
  - Verifies cookie player ownership. Wrong owner returns generic `404 Not Found`.
  - Checks 24h expiration (`expires_at <= now()`); raises `41001` (`SESSION_EXPIRED`).
  - Verifies revision counter; raises `40902` (`STALE_REVISION`) on mismatch.
  - Transitions:
    - `hint`: increments `hint_stage` up to 3; rejects past stage 3 (`40906`).
    - `skip`: transitions round state to `skipped`, sets score = 0, records reveal snapshot.
    - `next`: advances `current_round` only if current round is terminal (`correct`, `skipped`, `exhausted`); sets session `completed` when advancing past round 10.
  - Atomically increments revision and records action idempotency key into `public.game_actions`.
- `record_game_action`:
  - Caches safe response snapshot for idempotent replays.

### 5. API Endpoints
- `POST /api/player`: establish/reuse anonymous player cookie.
- `POST /api/games`: create session `{ mode, difficulty, actionId }`.
- `GET /api/games/[id]`: resume/rehydrate safe session state.
- `POST /api/games/[id]/hint`: advance hint stage `{ roundId, actionId, revision }`.
- `POST /api/games/[id]/skip`: skip round `{ roundId, actionId, revision }`.
- `POST /api/games/[id]/next`: advance to next round `{ roundId, actionId, revision }`.

## Validation Evidence

- `pnpm lint`: 0 errors, 0 warnings.
- `pnpm typecheck`: route types generated, TypeScript clean.
- `pnpm test`: 7 test files, 104 unit tests passed (grapheme masking, nested reveals, clue building, safe DTO stripping, single/mixed selection, backtracking, and origin checks).
- `pnpm test:db`: isolated PostgreSQL 17 container verified all 4 migrations, role/RLS denial, catalog staging/activation, and game lifecycle (session creation, idempotency, revision checks, hint/skip/next mutations, and 24h expiry).
- `pnpm build`: Next.js 16.4.5 App Router production build succeeded with dynamic API routes.
