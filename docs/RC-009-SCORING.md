# RC-009: Answer Normalization, Validation, and Scoring Implementation Notes

## Summary
Implements free-text title normalization, choice-handle identity encoding, ambiguity handling, attempt rules, 0-point boundary scoring, and transactional guess mutations for ReelClue per PRD Section 7.

## Key Changes
1. **Normalization & Input Validation (`src/lib/game-rules/normalization.ts`)**:
   - `normalizeTitle(text)`: Unicode NFKD normalization, strips combining diacritical marks (`[\u0300-\u036f]`), folds case (`toLowerCase()`), converts `&` to `'and'`, removes non-alphanumeric punctuation while preserving spaces and digits, and collapses whitespace.
   - Preserves sequel numbers (e.g. `Iron Man 2` vs `Iron Man`) and leading articles (`The Dark Knight`).
   - `validateGuessInput(text)`: Rejects non-string, blank/whitespace, >150 character inputs, or strings without alphanumeric characters.

2. **Scoring Rules (`src/lib/game-rules/scoring.ts`)**:
   - Pure scoring function: `calculateRoundScore(level, wrongAttempts, hintsUsed)`.
   - Base scores: Easy = 100, Medium = 150, Hard = 200.
   - Deductions: 25 points per wrong attempt (max 2 prior to correct solve), 20 points per hint (max 3).
   - Floors at 0 points (e.g. Easy with 2 wrong attempts + 3 hints = 100 - 50 - 60 = -10 -> 0 points).

3. **Tamper-Resistant Choice Handles (`src/lib/server/game/choiceHandle.ts`)**:
   - HMAC-SHA256 signature over base64url-encoded TMDB movie ID.
   - Server-only verification ensuring client cannot forge or alter selected movie identity.

4. **Transactional Database Mutation (`supabase/migrations/202611040005_game_scoring.sql`)**:
   - RPC `public.apply_game_guess`:
     - Locks session and round rows (`FOR UPDATE`).
     - Checks idempotency key and request hash against `public.game_actions`.
     - Validates active session, non-expired status, matching revision, and round state (`guessing`).
     - Ambiguous guesses: logs guess outcome `ambiguous`, returns choices without consuming an attempt or incrementing revision.
     - Correct guesses: awards calculated points, increments session score, updates round state to `correct`, attaches reveal snapshot, increments revision.
     - Wrong guesses: checks for duplicate wrong guesses (via existing round guesses); duplicate guesses consume NO attempts and do NOT increment revision.
     - Non-duplicate wrong guesses: increments `wrong_attempts`. If 3 wrong attempts reached, sets round state to `exhausted`, score to 0, attaches reveal snapshot.
     - Terminal lock: prevents further guesses on `correct`, `exhausted`, or non-guessing rounds (error `40905`).

5. **API Endpoint (`src/app/api/games/[id]/guess/route.ts`)**:
   - App Router POST endpoint verifying player identity cookie.
   - Accepts either `answerText` or `choiceHandle` (mutually exclusive).
   - Coordinates catalog lookup for free-text candidates and handles remakes / ambiguity.

6. **Automated Verification**:
   - 15 unit tests in `tests/unit/scoring.test.ts` verifying NFKD, ampersands, punctuation, sequel distinction, length bounds, scoring matrix, and HMAC tampering.
   - Integration test suite in `tests/integration/scoring.sql` executed against isolated PostgreSQL engine verifying attempt consumption, duplicate wrong checks, ambiguity, 0-point correct solves, terminal locks, and RLS/RPC denials for browser roles.
