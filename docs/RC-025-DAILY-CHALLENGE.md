# RC-025: Daily Challenge with Stable Daily Puzzle

## 1. Overview and Feature Goals

The **Daily Challenge** provides ReelClue players with a repeatable daily puzzle:
- **Shared Experience**: Every player worldwide receives the exact same 10-round movie puzzle on any given date.
- **Fairness & Consistency**: Derived deterministically from the UTC date (`YYYY-MM-DD`) and frozen catalog version using an isolated Mulberry32 pseudo-random number generator.
- **No Cheat Surface**: Future answers, movie titles, and clue sequences are never sent to the browser in advance. The client only receives the current round's clue.
- **Official vs. Practice Attempts**: Each player gets exactly one official attempt per UTC day. Subsequent attempts remain available as unranked practice mode.
- **Zero Account Wall / No Public Leaderboard**: True to ReelClue's core principles, no login, payment, timer, or public leaderboard is required.

---

## 2. Timing and UTC Day Boundary Rules

- **Reset Time**: The Daily Challenge resets strictly at **00:00:00 UTC** every calendar day.
- **Local Time Display**: The client UI displays the upcoming reset time both as a live countdown (`HH:MM:SS`) and mapped to the player's local timezone.
- **Cross-Boundary Protection**:
  - If a player starts their official challenge at 23:55 UTC and finishes at 00:05 UTC, their game session remains valid and tied to the UTC date on which it started.
  - Reloading the page or switching devices/timezones does not wipe the active attempt; the server restores the ongoing session from `daily_challenge_attempts`.

---

## 3. Deterministic Round & Clue Selection

1. **Seed Construction**:
   $$\text{Seed} = \text{"daily:"} \parallel \text{dateStr} \parallel \text{":"} \parallel \text{catalogVersionId}$$
2. **Mulberry32 PRNG**:
   A lightweight, 32-bit deterministic PRNG stream is initialized from the hash of the seed string. This guarantees identical numbers across all architectures, operating systems, and Node runtimes.
3. **Balanced Mode Allocation**:
   The puzzle selects exactly 10 movies from the active catalog's `medium` tier, allocating exactly 2 rounds for each of the 5 clue types:
   - 2 Poster Blur rounds
   - 2 Missing Title rounds
   - 2 Synopsis rounds
   - 2 Director & Cast rounds
   - 2 Genre Detective rounds
4. **Deterministic Reveal Seeds**:
   Reveal seeds for `game_rounds` are generated deterministically using RFC 4122 v4 UUID format derived from `reveal:<date>:<catalogVersionId>:<ordinal>:<movieId>`, ensuring deterministic poster blur and letter reveals across players.

---

## 4. Frozen Catalog Architecture

- When the first player requests the daily puzzle for date $D$, the server computes the 10 rounds and stores them in the `daily_challenges` table:
  - `challenge_date` (`DATE PRIMARY KEY`)
  - `catalog_version_id` (`UUID`)
  - `rounds` (`JSONB`)
- Subsequent requests on the same day read directly from the frozen `daily_challenges` record.
- **Catalog Refresh Immunity**: Even if a catalog sync occurs (`pnpm catalog:sync --apply`), the daily challenge for date $D$ remains frozen and unaffected.

---

## 5. Player Attempt Lifecycle

1. **Unstarted State**:
   - Player visits `/daily`.
   - Sees challenge metadata, countdown, and "Start Official Challenge" button.
2. **In-Progress State**:
   - Session created and linked in `daily_challenge_attempts(player_id, challenge_date, session_id, is_official=true)`.
   - Returning to `/daily` displays "Challenge In Progress (Round X of 10)" and a "Resume Challenge" button.
3. **Completed State**:
   - Player completes all 10 rounds.
   - `/daily` displays "Today's Challenge Completed!" with their official score.
   - Offers "View Results" and "Play Practice Round".
   - Official score is locked; practice sessions are flagged `is_official=false`.

---

## 6. Database Schema (`supabase/migrations/202611040008_daily_challenge.sql`)

```sql
create table if not exists public.daily_challenges (
  challenge_date date primary key,
  catalog_version_id uuid not null references public.catalog_versions(id),
  rounds jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.daily_challenge_attempts (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.anonymous_players(id) on delete cascade,
  challenge_date date not null references public.daily_challenges(challenge_date) on delete cascade,
  session_id uuid not null references public.game_sessions(id) on delete cascade,
  is_official boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_unique_official_daily_attempt
  on public.daily_challenge_attempts (player_id, challenge_date)
  where is_official = true;
```

---

## 7. UI UX Guidelines Alignment

- Complies with [`design-system/reelclue/MASTER.md`](../design-system/reelclue/MASTER.md):
  - 44px min hit targets for all buttons and interactive cards.
  - Visible 2px amber focus outlines with 3px offset.
  - Polite ARIA live regions for announcements and status updates.
  - Accessible countdown timer with tabular numerals.
  - Dark theme palette (`#10131A` canvas, `#1A2030` card surfaces, `#F4C95D` amber primary).
