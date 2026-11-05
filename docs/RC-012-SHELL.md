# RC-012: Responsive Gameplay Shell and Recovery States Implementation Notes

## Summary
Implements responsive gameplay shell, UI reducer, clue renderers for all 5 modes, terminal round reveal card, recoverable error banners, and quit/skip confirmation flows per PRD Sections 6, 8, 11, 13 and Issue #12.

## Key Changes
1. **Gameplay Reducer (`src/features/game/gameplay-reducer.ts`)**:
   - Manages state machine across `loading`, `idle`, `submitting`, `hinting`, `skipping`, `advancing`, `completed`, `expired`, and `error`.
   - Single-action mutex: in-flight ref and reducer states prevent competing action executions during mutations.
   - Idempotent retries: preserves `lastActionId` and `lastActionPayload` when an action encounters a network or transient error so retrying uses the identical ID.
   - Ambiguity support: handles `outcome === "ambiguous"` with `choices` array, keeping user typed input intact.
   - Stale state recovery: handles `STALE_RELOAD` to reconcile session from server when revision conflicts (HTTP 409) occur.

2. **Clue Renderers (`src/features/game/clue-renderer.tsx`)**:
   - `poster`: renders transformed poster image bytes with generic alt text (`alt="Movie poster clue"`), never exposing movie title or answer in HTML/attributes; includes stage-revealed year and genre badges.
   - `title`: renders masked title string (`_ _ _`) with monospaced letter spacing.
   - `synopsis`: renders sanitized movie overview quote and hint badges (decade, genre, director).
   - `cast`: renders director name, cast member roster, and release year.
   - `genre`: renders primary genre pills, decade, language, and additional hint markers.

3. **Terminal Reveal View (`src/features/game/terminal-reveal-view.tsx`)**:
   - Outcome card displaying win/loss state (`correct`, `exhausted`, `skipped`), round score breakdown, and wrong/hint tallies.
   - Full movie reveal with TMDB poster, title, original title, director, cast, synopsis, and external TMDB link.
   - Strictly waits for explicit user click on the `Next Round` button; never advances automatically.

4. **Gameplay Shell Coordinator (`src/features/game/gameplay-shell.tsx`)**:
   - Loads session on mount via `GET /api/games/[id]`; establishes anonymous player cookie if missing.
   - Displays game header: round progress bar (e.g. 1/10), mode name, difficulty level, attempts left, and score.
   - Answer box: integrates accessible autocomplete combobox and free text submission.
   - Hints: calculates progressive hint labels (-20 pts) via `getHintDetails` in `src/features/game/hint-helpers.ts`.
   - Skip confirmation dialog: warns about 0 points before invoking `POST /api/games/[id]/skip`.
   - Exit confirmation dialog: explains progress is preserved for 24 hours before redirecting.
   - Mobile keyboard & safe-area: includes `pb-[max(2rem,env(safe-area-inset-bottom))]` and flexible combobox overlay layout.
   - Recoverable error handling: HTTP 409 automatically invokes `GET /api/games/[id]` to re-sync revision; transient errors display a retry button that reuses the previous action ID.

5. **Page Metadata (`src/app/play/[id]/page.tsx`)**:
   - Sets static, generic title and description ("Play ReelClue", "Guess the movie from progressive clues in ReelClue"). Never discloses active movie answers or round parameters.

6. **Validation**:
   - 15 unit/component tests in `tests/unit/gameplay-shell.test.tsx` verifying:
     - Hint helpers progression and labels.
     - Clue renderers for all modes, verifying strictly generic poster alt text.
     - Terminal reveal outcome presentation and manual Next requirement.
     - Reducer transitions (guess submission, ambiguous outcome, duplicate wrong answer, stale reload reconciliation).
     - Gameplay shell lifecycle (loading, active clue rendering, exit confirmation with 24h message, skip confirmation, 409 conflict resync).
   - Validation pipeline:
     - `pnpm lint`: clean (0 errors, 0 warnings).
     - `pnpm typecheck`: clean (`next typegen && tsc --noEmit`).
     - `pnpm test`: 12 test suites, 156 tests passing.
     - `pnpm test:db`: Docker Desktop daemon not running on host (reported honestly).
     - `pnpm build`: Next.js production build succeeded.
