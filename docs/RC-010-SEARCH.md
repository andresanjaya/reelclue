# RC-010: Catalog Search and Accessible Answer Autocomplete Implementation Notes

## Summary
Implements same-origin catalog search and accessible answer autocomplete per PRD Section 7 & 10 and Issue #10.

## Key Changes
1. **Catalog Search SQL Function (`supabase/migrations/202611040006_catalog_search.sql`)**:
   - `search_catalog_movies(p_query, p_limit)`:
     - Scopes search strictly to the current active catalog version (`status = 'active'`).
     - Matches case-insensitively on canonical `title`, `original_title`, and `approved_aliases`.
     - Prioritizes exact matches first, prefix matches second, then by popularity desc.
     - Enforces max 8 results.
     - Returns only `tmdb_id`, `title`, and `release_year`.
     - Exposes NO answer flags, popularity ranks, tier labels, or session membership.
     - Accessible exclusively by `service_role`; execution revoked from `anon` and `authenticated`.

2. **Server Search Service (`src/lib/server/catalog/search.ts`)**:
   - `searchCatalogMovies(query, limit)`: executes `search_catalog_movies` via `service_role` Supabase client.
   - Encodes each returned movie ID into an opaque, tamper-resistant HMAC-SHA256 `choiceHandle`.
   - Returns safe `MovieSearchItem[]`.

3. **API Endpoint (`src/app/api/movies/search/route.ts`)**:
   - `GET /api/movies/search?q=...`
   - Requires valid `reelclue_player` identity cookie (returns 401 if missing).
   - Validates query bounds: enforces 2 <= trimmed query length <= 100 (returns 400 validation error if out of bounds).
   - Returns `{ items: MovieSearchItem[] }` with `Cache-Control: private, no-store`.

4. **Client Search Hook (`src/features/game/use-movie-search.ts`)**:
   - `useMovieSearch(query, options)`:
     - 300ms debounce to minimize unnecessary network traffic.
     - Immediate clearing when query < 2 characters.
     - `AbortController` cancellation of previous in-flight requests.
     - Stale response protection: superseding queries discard older responses even if older responses resolve later.
     - Error and loading state management with non-cascading render design compliant with React compiler / hooks rules.

5. **Accessible Combobox Integration (`src/features/game/answer-combobox.tsx`)**:
   - `SearchableAnswerCombobox`: drop-in wrapper composing `useMovieSearch` with `AnswerCombobox`.
   - Accessible WAI-ARIA combobox with `role="combobox"`, `role="listbox"`, `role="option"`, `aria-autocomplete="list"`, `aria-activedescendant`, and live status announcements.
   - Circular keyboard navigation: ArrowUp, ArrowDown, Escape, Enter.
   - Enter on suggestion selects without submitting parent form; closed list allows Enter submission.
   - Selecting a choice does not submit; free text remains supported.
   - Remakes with identical titles render distinct release years.
   - Mobile touch targets meet >= 44px (`min-h-11`).

6. **Validation**:
   - `tests/unit/search.test.ts`: unit tests for bounds validation, safe serialization (no answer flags, no posters, no popularity), remake distinction, and RPC error handling.
   - `tests/unit/combobox-search.test.tsx`: component and hook tests for 300ms debounce, cancellation, stale response suppression, keyboard navigation, touch targets, and free-text typing.
   - `tests/integration/search.sql`: PostgreSQL integration tests verifying active-catalog version scoping, alias/original matching, limit 8, exact/prefix ranking, and RLS/RPC denials.
