# RC-011: Home and Game Setup Flow Implementation Notes

## Summary
Implements Home (`/`), How to Play guide, mode cards showcase, setup flow (`/play`), and transition to active play (`/play/[id]`) per PRD Section 6, 8, 13 and Issue #11.

## Key Changes
1. **Home Page (`src/app/page.tsx`)**:
   - Concise cinema quiz pitch: "Movie guessing, one clue at a time — ReelClue", "Every clue brings you closer."
   - Primary "Play Now" / "Start Game" call to action linking to `/play`.
   - Six interactive mode showcase cards (Poster Blur, Missing Title, Synopsis, Director & Cast, Genre Detective, Mixed). Each links to `/play?mode=<modeId>` to preselect that mode in setup.
   - Concise How to Play guide with 4 numbered steps (Pick challenge, Inspect clues & hints, Guess the title with 3 attempts, Score 100–200 points across 10 rounds).
   - Bottom CTA banner and TMDB attribution footer.
   - Completely free of login walls, accounts, and timers.

2. **Game Setup Flow (`src/features/game/play-setup.tsx` & `src/app/play/page.tsx`)**:
   - Wrapped in `<Suspense>` boundary for static generation compatibility with `useSearchParams`.
   - Defaults: Poster Blur (`poster`) mode and Easy (`Easy`) level.
   - Query parameter preselection: parses `?mode=...` and preselects valid requested mode.
   - Automatic background initialization of anonymous player cookie identity via `POST /api/player`.
   - Double-tap guard: ref lock (`submittingRef.current`) and button disabling prevent concurrent requests or accidental duplicate session creation.
   - Idempotent action ID generation (`crypto.randomUUID()`) per session initiation attempt.
   - Recoverable error handling:
     - 400 `CATALOG_SHORTAGE`: explains catalog shortage without resetting player's mode or level selections.
     - 503 `CATALOG_UNAVAILABLE`: friendly recoverable message.
     - 429 rate limit and network errors: recoverable inline feedback without changing selections.
   - Only navigates to `/play/[id]` on successful 201 response.

3. **Active Play Placeholder Route (`src/app/play/[id]/page.tsx`)**:
   - Resolves dynamic session routes cleanly so successful game creation navigates directly into the game route (preparing for RC-012 full shell).

4. **Validation**:
   - 7 unit/component tests in `tests/unit/setup.test.tsx` verifying:
     - Home brand pitch, How to Play, and mode links.
     - Absence of login forms, passwords, or timers.
     - Setup default selections (Poster Blur / Easy).
     - Query parameter preselection.
     - Double-tap deduplication guard.
     - Catalog shortage error preservation of user selections.
     - Network failure retry capability.
   - Full pipeline verified: `pnpm lint`, `pnpm typecheck`, `pnpm test` (141 tests passing), `pnpm test:db`, `pnpm build`.
