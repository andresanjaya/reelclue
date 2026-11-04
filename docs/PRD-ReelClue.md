# ReelClue — Product Requirements Document

Version 1.1 · 4 November 2026 · Owner: Andre Sanjaya

**Tagline:** Every clue brings you closer.

**Repository:** https://github.com/andresanjaya/reelclue  
**Project:** https://github.com/users/andresanjaya/projects/7/views/1  
**Document status:** Proposed baseline, awaiting Andre's review. This is a specification, not evidence of an implemented or deployed product.

## 1. Product summary

ReelClue is a mobile-first movie guessing web game for Andre's playground. Players identify a movie from a blurred poster, incomplete title, synopsis, director and cast, or genre-based clues. They choose a clue mode and difficulty, play ten short rounds, reveal extra hints when stuck, and receive a result they can replay or share later.

The difficulty describes how recognizable the movies are. Easy should feel familiar; Medium should reward regular movie watching; Hard should offer well-regarded, less mainstream films with an established audience. Hard must not simply mean selecting the least popular movies in TMDB.

MVP is a casual single-player experience, with no account, monetization, public leaderboard, or native app. It must work with one thumb on a phone and with keyboard input on desktop.

## 2. Problem, audience, and assumptions

**Problem:** A single poster quiz becomes repetitive, and a random TMDB sample can be unfair: either too obvious or so obscure that guessing is pointless. ReelClue offers different ways to recall films and makes difficulty understandable.

**Primary audience:** casual movie watchers and enthusiasts, initially Andre and his Indonesian/English-speaking friends. Mobile is the primary device; sessions should take roughly 3–6 minutes, a design hypothesis rather than measured behavior.

**Jobs to be done:**
- Play something entertaining during a short break without registering.
- Test movie knowledge using the type of clue I enjoy.
- Increase the challenge without encountering entirely unknown films.
- Discover a film after missing the answer and try again immediately.

**Assumptions to validate:** English movie titles are acceptable; typed answers with autocomplete are usable on mobile; ten rounds feel short enough; TMDB vote counts are a useful familiarity proxy. These are hypotheses, not research findings. UI and clues default to English for v1; architecture must allow Indonesian localization later. Indonesian movie collections are a later extension, not silently treated as covered by a global familiarity score.

## 3. Goals and success criteria

| Goal | Proposed validation / target |
| --- | --- |
| Quick entry | New player reaches the first clue in at most 3 intentional actions after load: choose mode, choose difficulty, Start |
| Complete mobile session | All six mode choices can complete 10 rounds at 360px width without horizontal scrolling |
| Fair difficulty | Review 10 randomly sampled movies per level; Andre judges at least 8/10 appropriate before public launch |
| Engaging MVP | Pilot with at least 5 people; proposed target ≥70% of started sessions completed, ≥30% replay; report actual sample size |
| Reliable guessing | Deterministic alias tests; no points from duplicate/retried writes or modifying browser state |
| Usable performance | Proposed mobile targets: LCP ≤2.5s, INP ≤200ms, CLS ≤0.1; lab measurements guide launch, field targets require real traffic |
| Understandable failures | Failed network requests offer retry and never consume an attempt or hint |

Collect minimal anonymous session aggregates for the pilot: started, completed, rounds won, hints used, mode, and difficulty. Do not add behavioral tracking vendors by default. A completed-session rate is completed / successfully created sessions; replay is a new session within 30 minutes for the same anonymous browser. Both depend on cookie availability and are approximate.

## 4. Scope and release boundaries

| MVP / P0 | Later / P1 | Out of scope |
| --- | --- | --- |
| Poster Blur, Missing Title, Synopsis, Director & Cast, Genre Detective, Mixed | Daily Challenge; spoiler-free share result; installable PWA; Indonesian collection | Accounts, multiplayer rooms, prizes, payments, global leaderboard, TV series, streaming, AI-generated movie facts |
| Easy / Medium / Hard | Richer stats and optional localization after validation | Scraping streaming services, requiring TMDB user login |
| 10 rounds, 3 wrong attempts per round, up to 3 hint actions | Additional session lengths and timed modes | Full CMS or admin dashboard |
| Autocomplete plus typed answers, deterministic title aliases | Friend challenges | Fuzzy matching that automatically accepts another movie |
| Server scoring and resumable anonymous session | | |
| Mobile layout, accessibility, credits, errors, tests, deployment runbook | | |

P1 tickets are created as future backlog, but must not block the MVP launch or start without an explicit instruction to take that ticket.

## 5. Recommended technology and reasons

| Area | Decision | Reason / boundary |
| --- | --- | --- |
| Language | TypeScript strict | Shared contracts for movie, clue, and session data |
| Web framework | Next.js App Router, supported stable release at implementation time | React UI and server Route Handlers in one repository |
| UI | Tailwind CSS + shadcn/ui + Lucide icons | Consistent responsive controls and accessible primitives |
| UI design guidance | UI UX Pro Max for OpenCode | Required development-time workflow; setup in RC-002, approved design baseline in RC-003; not a browser dependency |
| State | React reducer for game UI; server is authoritative | No Redux/Zustand requirement for a small game |
| Validation | Zod | Validate env, requests, TMDB payloads, and response DTOs |
| Database | Supabase Postgres through server-only client | Persist curated catalog and anonymous game state across serverless instances |
| Images | Sharp in Node runtime; allowlisted TMDB image fetch | Deliver a real blurred bitmap for unrevealed posters; CSS alone is removable |
| Statistics | Versioned localStorage, with server result IDs for deduplication | No login needed; local stats are convenience, not competitive records |
| Tests | Vitest + Testing Library; Playwright for meaningful flows | Rules and transactions are deterministic; E2E covers mobile play |
| Package manager | pnpm with pinned version and lockfile | Reproducible OpenCode and CI setup |
| Hosting | Vercel for Next.js; Supabase for DB | Familiar small-project setup; verify current quotas before deployment |
| CI | GitHub Actions | Typecheck, lint, tests, build before review |

Use package versions that work together and commit the lockfile. Do not copy a guessed version from this document or install canary releases. No separate Express backend, microservices, Docker requirement for ordinary UI work, or native React Native application is needed. Database integration tests may use a local Supabase environment if available or an isolated test project; never production.

**Alternative considered:** Vite + client-only TMDB calls would be smaller, but exposes application credentials in the browser and makes answers and scoring trivially editable. A Next.js server plus persistent DB provides a clearer boundary for this game. This is an architectural choice, not a claim that casual games are cheat-proof.

## 6. Experience and information architecture

Routes:
- `/`: concise pitch, six mode cards, How to Play, primary Play action.
- `/play`: mode/difficulty setup. Default mode Poster Blur, default level Easy. No timer.
- `/play/[sessionId]`: active question and round reveal; session ID alone does not authorize access.
- `/results/[sessionId]`: completed game results, owned by the browser session.
- `/stats`: local per-device summary and clear-history control.
- `/about`: credits, TMDB attribution, game limitations, basic privacy explanation.

Home mode-card activation opens setup with that mode selected. Choosing a mode on setup replaces the selection; Start is the only session-creation action. The active game has no competing navigation CTA.

### Main flow
1. Choose a mode and difficulty; Start shows loading once and creates one session.
2. Server selects 10 distinct eligible movies, freezes catalog/rules versions, and returns round 1's allowed clue only.
3. Player submits a typed title or picks an autocomplete option. Typing/selecting an option does not auto-submit.
4. Wrong answer: consume one wrong attempt and retain the current clue. Correct: lock the round, calculate points, show the movie reveal.
5. Hint: show the next permitted clue and apply its scoring effect; it does not consume a wrong attempt. Skip: terminal round, zero points.
6. Third wrong answer also ends the round. All terminal rounds show the answer, then Next; no automatic navigation.
7. After round 10, show results. Play Again opens setup with previous choices; the player confirms Start.

The game has explicit states: loading, guessing, submitting, revealing, advancing, completed, recoverable-error, expired. Disable competing actions during a mutation. The server enforces the same transitions so a second tab cannot bypass them.

## 7. Rules, answers, hints, and scoring

**Session:** exactly 10 distinct movie IDs, one level, one mode selection, valid for 24 hours since creation; expired sessions retain only the outcome when completed, otherwise offer a fresh game. No timer or speed bonus in MVP. Local duration is optional display only.

**Attempts:** three wrong nonempty submitted guesses per round. Blank/whitespace, too-long input (>150 characters), malformed request, network failure, and exact duplicate wrong guess do not consume attempts. Wrong guesses remain visible; duplicate wrong guesses return the existing feedback. Submitted payload size capped at 8KiB.

**Answer methods:**
- Autocomplete searches only the server-curated eligible catalog, across levels, rather than the current ten answers. Query ≥2 characters, debounce 300ms, return at most 8 items, title + release year only. No posters, answer flags, popularity ranks, or current-session membership. Abort outdated searches.
- Selecting a result submits its opaque choice handle tied to movie ID server-side; matching uses identity, including remakes.
- Free text is accepted against canonical English title, original title, approved alternative titles, and reviewed aliases. Normalize Unicode NFKD, remove combining marks, case-fold, convert `&` to `and`, remove punctuation, trim, collapse spaces. Preserve numbers and sequel numbers. Do not strip leading articles or automatically turn Roman numerals into Arabic numbers; add reviewed explicit aliases if justified.
- If an alias corresponds to more than one catalog movie, require selection of title + year rather than marking a wrong movie correct. An ambiguous text answer consumes no attempt and explains the next action.
- No automatic fuzzy acceptance or LLM judgment. A typo may prompt selecting the intended autocomplete result, without confirming whether it is correct.

**Hints:** max 3 actions per round, each separately confirmed by pressing a visible button labelled with its effect. No hidden automatic hints after wrong answers. All mode stages are deterministic for a round; repeated hint request IDs return the same result.

**Round score:** `max(0, base - 25*wrongAttempts - 20*hintsUsed)` for a correct answer; base Easy=100, Medium=150, Hard=200. Skip or exhausted attempts =0. A correct answer after 2 wrong guesses and 3 hints on Easy scores 0; do not promise a minimum. Session score is the sum of 10 server round scores; maximum 1000/1500/2000. Hints do not change movie difficulty. No streak multiplier in MVP. Results compare performance within the same difficulty and mode, not as a universal competitive ranking.

**Common terminal reveal:** original poster, English title, original title if different, year, genres, director, up to 5 cast names, short synopsis, round outcome, hints/attempts and points; link to TMDB. Use metadata fallbacks visibly rather than inventing credits.

## 8. Game modes

| Mode | Initial clue | Hint 1 | Hint 2 | Hint 3 | Eligibility |
| --- | --- | --- | --- | --- | --- |
| Poster Blur | Server-blurred poster, sigma 24 | sigma 16 | sigma 8 | Release year + first genre; image stays sigma 8 | Valid decodable poster |
| Missing Title | 35% of letters shown | 50% shown | 65% shown | 80% shown | At least 5 letter/digit graphemes |
| Synopsis | Sanitized synopsis, max 600 characters, clipped at sentence/word boundary | Release decade | Primary genre | Director name | Nonempty sanitized synopsis ≥100 chars + director + genre |
| Director & Cast | Director name | First billed cast member | Second billed cast member | Third billed cast member + release year | Director and ≥3 distinct cast people |
| Genre Detective | Up to 3 genres + release decade | Original language | Director | First billed cast member + exact release year | Genre, director, cast, release year and language available |
| Mixed | One of the 5 modes assigned to this round | Per assigned mode | Per assigned mode | Per assigned mode | Every selected movie eligible for its assigned mode |

No soundtrack, movie clips, trailers, or performer portraits in MVP. Showing a cast name is enough to satisfy cast clues and avoids additional image traffic.

### Poster specifics
Render 300×450 transformed images; standardize source canvas by cover crop. Sigma is an initial tuning value to validate on phones, independent of movie tier. Extra edge padding/crop prevents blur borders. The actual transformed pixels are returned from an owned route with an opaque round ID and authorized server stage; do not send the unblurred image and apply CSS. Missing source or decoding failure disqualifies that movie for Poster mode; an upstream failure during a round shows retry or server-authorized replacement without changing attempts/score. Never reveal the clear poster before a terminal answer. Cache transformed bytes by movie, source revision, dimensions, and sigma internally, but serve private responses. Limit source bytes (5MiB), timeout, redirects, and allowed hosts to avoid arbitrary image-fetch URLs. Enforce decoded pixel limits as well.

### Missing Title specifics
Mask the canonical English display title by Unicode grapheme, preserving spaces and punctuation; one underscore slot per hidden letter/digit. Reveal order is seeded once and nested between stages, not regenerated after render or refresh. For N maskable characters show `min(N-1, max(1, floor(N*fraction)))`; never reveal the whole title through hints. The short-title rule excludes unusable puzzles rather than leaking the answer. A title remains partly visible by design; do not claim this clue mode can hide all lexical information.

### Synopsis specifics
Use TMDB text, not AI-generated summaries. Remove HTML. Replace full normalized canonical/original/approved-alias title occurrences with `[movie]` using token boundaries and Unicode-aware comparison. If a very short/common alias makes sanitization destroy the clue or a normalized title is still exposed, exclude that synopsis from play and flag for review. Do not redact every ordinary word contained in a multiword title. Store sanitized clue revision; no clear title in tooltips, hidden spans, alt text, or HTML metadata. Check common leaks manually before release.

### Director, cast, and genre fairness
One exact question film is selected in advance; a director or genre is not expected to identify it uniquely. Extra hints, decade and autocomplete make the puzzle playable. Accept only the chosen movie identity. Indicate that several films can fit early clues. Never present the early clue as a logically unique identification. Preserve billed cast ordering; support co-directors and deduplicate cast identities.

### Mixed distribution
Exactly 2 rounds per underlying mode in a 10-round game, shuffled once. First allocate 2 per mode with the most constrained eligibility pools first, sample without repeating a movie across assignments, and retry with bounded deterministic backtracking (maximum 100 attempts). If no valid assignment exists, return a clear catalog-shortage error, not a shortened or unbalanced game. A session's assigned order never changes on refresh.

## 9. Movie catalog and difficulty policy

### What TMDB can and cannot tell us
TMDB popularity is a changing engagement metric influenced by votes, views, favorites, watchlists, and release date. It is not a count of viewers or box-office sales. Vote count is also only a proxy for familiarity. Revenue is supplemental and can be missing. There is no reliable universal TMDB flag for "underrated." In this product, Hard means **well-regarded hidden gems**, not an empirical claim that a film deserves a higher rating.

### Base eligibility
- Movie only; `include_adult=false`, `include_video=false`; released status, known primary release date at least 90 days before catalog build; runtime ≥60 minutes.
- English display title present; usable English/original aliases, year, genres, and per-mode metadata.
- At least 500 TMDB votes globally. This floor is never lowered automatically to fill a session.
- No banned/removed entries; exclude known duplicate records, malformed sources, and titles flagged as unplayable.
- Catalog is curated before gameplay, not a live random TMDB page on every round. Initial candidate target: roughly 1,000 movies to produce at least 300 approved movies. This is a target to validate against real data, not a claimed available count.

### Familiarity score
For each eligible candidate, compute percentile rank from 0–1 using `log1p(vote_count)`, `log1p(popularity)`, and `log1p(revenue)` across the frozen candidate snapshot (revenue percentile uses only known positive values); rank ties use the average occupied rank, and a one-item dimension is rank 0.5. Missing/zero revenue is unknown, never evidence of obscurity: use `0.8*votePercentile + 0.2*popularityPercentile` when revenue is unknown; otherwise `0.7*votePercentile + 0.2*popularityPercentile + 0.1*revenuePercentile`.

Rank candidates by this score; highest-score percentile is 1. Ties broken by vote_count descending then TMDB ID ascending for deterministic tier assignment. Use disjoint tiers:

| Tier | Initial rule | Product meaning |
| --- | --- | --- |
| Easy | Top 30% of ranked candidate pool AND ≥5,000 votes | Broadly familiar films |
| Medium | Next 40% AND ≥1,500 votes | Recognizable to regular viewers |
| Hard | Bottom 30% of eligible pool, 500–9,999 votes AND vote_average ≥7.0 | Less mainstream, well-regarded films with audience evidence |

Candidates failing the gate in their assigned band remain unassigned until reviewed; never force them into another tier. All weights, cutoffs, and eligibility rules are configuration with version identifiers. They are starting hypotheses. Do not market them as a measured probability a particular user knows a movie.

**Curated overrides:** A versioned JSON file may assign an eligible film to a specific tier or exclude it, with TMDB ID, reason, reviewer, and reviewed date. An override may move a popular cult classic out of Hard. Overrides cannot bypass adult/release/runtime/base vote floors or metadata requirements; a Hard override must still meet Hard rating/vote gates. Conflicts fail the importer instead of silently selecting the last entry.

**Sampling:** at least 100 approved films per tier overall and at least 30 eligible films per mode/tier at launch. A single-mode session must have 10 unique eligible movies after exclusions. Mixed must satisfy its assignment rule. Prefer excluding the last 30 movie IDs from this browser; if insufficient, relax only recent-history exclusion and disclose that repeat prevention is best-effort. Never relax level, adult, or minimum-vote rules. If the pool remains insufficient, explain unavailability and offer a user-selected alternative level/mode.

**Quality calibration:** Andre reviews 10 films per level, including mode clues, aliases, and current posters. Capture observed pilot win rate/hints by tier; proposed first-answer targets Easy 65–85%, Medium 40–65%, Hard 20–45% are tuning hypotheses, not launch guarantees. Change versions only between sessions. Individual familiarity varies by country, age, and taste.

## 10. TMDB integration and catalog refresh

Base URL: `https://api.themoviedb.org/3`. Use application Bearer authorization on server only; no user TMDB login required. API Key is an optional alternative, not a second required credential.

| Endpoint | Purpose |
| --- | --- |
| `GET /configuration` | Image base URL and supported sizes |
| `GET /genre/movie/list?language=en-US` | Genre IDs/names |
| `GET /discover/movie` | Bounded candidate batches, vote/date/runtime filters and sort orders |
| `GET /movie/{id}` | Full details incl. runtime/status/revenue |
| `GET /movie/{id}/credits` | Director crew entries and billed cast |
| `GET /movie/{id}/alternative_titles` | Reviewed answer aliases |
| `GET /movie/{id}/images` | Select usable poster variant when needed |

Discover filters include vote_count minimum/maximum and vote_average bounds. Use several bounded query slices (vote count descending, popularity descending, qualified high rating), then deduplicate by movie ID; do not fetch the entire TMDB catalog. Release-date window is evaluated at import time. Fetch details/credits/aliases only for bounded candidates, with concurrency ≤4, timeout 8 seconds, and two retries for transient errors (exponential backoff + jitter; respect Retry-After). Do not retry invalid credentials or permanent 404s. Never assume an unchanging provider quota; honor 429.

**Refresh strategy:** manual authenticated CLI import first (`pnpm catalog:sync --dry-run` then explicit apply). No public refresh endpoint. Weekly refresh may be configured later by the owner. Import into a new catalog version, validate coverage and required fields, review report, then atomically activate. A failed import leaves the previous active version intact. Keep old versions until referencing sessions expire; completed results keep minimal answer snapshots for 30 days. Refresh is operational work, not an implicit authorization to run a recurring automation now.

The sync must support a small fake provider fixture so UI and rules can be developed without live credentials. Fake fixtures are clearly marked and never served as a real TMDB-backed production catalog. Do not commit a scraped production dataset or transformed movie artwork into git; retain minimal fields in DB with source and timestamps. Confirm current TMDB terms for data retention, transformations and intended use before public release.

## 11. System architecture and trust boundaries

Browser → same-origin Next.js Route Handlers → domain services → Supabase and TMDB.

TMDB is used for catalog ingestion and image delivery. Active rounds are read from persisted catalog/session data, so basic guesses do not require a fresh provider call. Use server-only imports for TMDB and DB modules. Run the poster route under Node runtime because it uses Sharp.

Browser code receives only a safe `PublicRound` DTO: opaque round ID, round index/count, assigned clue mode, permitted clue payload, stage, remaining attempts, hints used, current score, status and version. It must not receive correct movie ID, future round list, aliases, raw provider JSON, answer-containing URL filenames, or clear poster before terminal state. Autocomplete choice handles reveal candidate titles by design; they do not reveal which is correct. Do not use sequential catalog indexes as answer keys.

This boundary reduces accidental answer leakage and credential exposure. It cannot prevent a determined player from recognizing films, using external tools or enumerating the intended autocomplete catalog. No competitive anti-cheat promise or public leaderboard is included.

### Persistence model
All tables enable RLS with no anon/authenticated browser policies for game/catalog writes or reads. Browser has no Supabase credential or direct DB connection. Server secret key access bypasses RLS; every route therefore validates ownership and data boundaries itself. Revoke public/anon/authenticated RPC execution for privileged transaction functions; grant only the server role required for those functions, set an explicit search_path.

| Entity | Key fields and constraints |
| --- | --- |
| `catalog_versions` | UUID, rules_version, imported_at, status(staging/active/retired), summary; one active version via partial unique index |
| `movies` | `(catalog_version_id, tmdb_id)` composite PK; title/original title/year, vote_count/average/popularity/revenue nullable, familiarity score/tier, runtime, language, genres, sanitized synopsis, cast/directors, approved aliases, poster path, eligibility flags |
| `anonymous_players` | UUID, token_hash unique, created_at, expires_at; 30-day browser identity |
| `game_sessions` | UUID, player_id, creation_action_id, creation_request_hash, catalog_version_id, mode, level, state, current_round, score, revision, created_at, expires_at, completed_at; unique(player_id, creation_action_id) |
| `game_rounds` | UUID, session_id, ordinal 1–10, movie_id, mode, hint_stage, wrong_attempts, state, score, reveal_seed; unique(session_id, ordinal) and unique(session_id, movie_id) |
| `game_actions` | session_id, idempotency_key, request_hash, action type, round_id, safe response snapshot, created_at; unique(session_id, idempotency_key) |
| `game_guesses` | round_id, normalized_guess or selected identity, outcome, ordinal, created_at; dedupe same normalized wrong answer per round |
| `rate_limit_buckets` | hashed browser/IP bucket, route class, time window, count, expires_at; bounded cleanup |

Use FK constraints and ON DELETE behavior deliberately; retain catalog rows while sessions refer to them. Minimize free-text guess retention; delete guesses/action records after 7 days. Incomplete sessions expire at 24h and purge after 7d; completed session/result snapshots purge after 30d; player tokens expire at 30d. Local stats can remain until the user clears them and this is explained in About. A manually runnable purge command is required; cron setup is optional operational configuration, not a reminder task.

### Anonymous ownership and safe mutations
Setup first calls `POST /api/player` and waits for its cookie response before enabling game creation. Game creation requires that established cookie and never silently creates another identity on retry. Generate a cryptographically random 256-bit browser token, store only SHA-256 hash in DB; set `HttpOnly`, `SameSite=Lax`, `Secure` in production, path=/, maxAge=30 days. Session URLs contain UUIDs, never the token. Check ownership on every state/result/poster route; do not authorize using a caller-supplied player ID. Return generic 404 for other players' games. Use origin checking on all mutation requests to reduce CSRF; no permissive cross-origin credentials.

All mutation calls include `actionId` UUID and expected `revision`. Under a DB row lock/transaction validate owner, expiry, current ordinal and state, apply once, increment revision and persist the response. An identical retried action returns its prior response. Reusing an action ID with a different payload returns 409. Conflicting concurrent actions return 409 with a fresh safe current state; do not duplicate points or attempts. Guard session creation with player + action ID uniqueness too. A network timeout must reuse the same action ID on retry.

## 12. API contract

Every response is validated before serialization. Private game/search/poster responses use `Cache-Control: private, no-store`; no CDN sharing or caching full session responses. Logs must never include authorization headers, tokens, database secret keys, raw request bodies or hidden answers.

| Route | Input | Output / semantics |
| --- | --- | --- |
| `POST /api/player` | Origin-checked, no caller-selected identity | Establish/reuse HttpOnly anonymous identity before game creation; return no token in JSON |
| `POST /api/games` | `{mode, difficulty, actionId}` | Owned sessionId + public round; 201; idempotent retry returns same session |
| `GET /api/games/:id` | Cookie ownership | Safe active state or terminal state; supports refresh/resume |
| `POST /api/games/:id/guess` | `{roundId, answerText? , choiceHandle?, actionId, revision}` exactly one answer input | Feedback, attempts, points; reveal only when round terminal |
| `POST /api/games/:id/hint` | `{roundId, actionId, revision}` | Next clue stage once; no advance past stage 3 |
| `POST /api/games/:id/skip` | same mutation envelope | Terminal reveal and 0 points |
| `POST /api/games/:id/next` | same mutation envelope | Next round only if prior terminal; after tenth returns result navigation |
| `GET /api/games/:id/results` | Cookie ownership | Completed outcome and all completed round reveals; 409 if incomplete |
| `GET /api/movies/search?q=...` | Browser identity, query 2–100 chars | ≤8 safe title/year/choice handles; same catalog scope, no answer flags |
| `GET /api/games/:id/rounds/:roundId/poster` | Cookie + current server stage | Transformed current clue image, or clear image only for terminal round |

Typed errors: `{error:{code,message,retryable},requestId,state?}`. Validation=400, missing/invalid browser identity=401, owned resource not found=404, stale/invalid state=409, expired=410, rate limit=429 + Retry-After, provider unavailable/DB unready=503. Do not return partial answer information inside error messages. Transient infrastructure errors never commit a game action.

## 13. UX, visual direction, and mobile requirements

Direction: playful cinema quiz with a clear dark canvas, warm amber primary action, and generous spacing. The UI should feel like a small polished game rather than a dashboard.

Suggested token baseline (verify contrast): background #10131A, surface #1A2030, text #F6F7FB, muted #ADB5C6, accent #F4C95D, dark text on accent #171717. Semantic success/error also use icon + text. Use one sans-serif family with system fallback. No logo asset generation is required for v1; use a simple ReelClue wordmark until Andre chooses an identity.

- 4px spacing scale; mobile page padding 16px, cards 16–20px, section gaps 24px, desktop content max 1120px; play column max 640px.
- Body/input font ≥16px; heading 24–32px mobile; controls min 44×44 CSS px; clearly visible focus and selected states.
- One-column gameplay; poster area preserves aspect ratio, width about 220px on 360px screens and never pushes the answer field unnecessarily far down. Normal vertical scrolling is allowed.
- Mobile answer controls remain reachable above the virtual keyboard; respect safe-area insets. A sticky action area must not cover suggestions, feedback or content. No viewport-locking that breaks iOS scrolling.
- Desktop may use clue and answer columns, but tab order follows clue → input → submit → hint → skip.
- Display Round 3/10, level, wrong attempts remaining and score as text. Mode icon always has a label.
- Use shadcn primitives where appropriate: Button, Card, RadioGroup/ToggleGroup, Badge, Input, Command/Popover or equivalent accessible combobox, Progress, Dialog/AlertDialog, Skeleton, Tooltip for optional help. Do not import every component unnecessarily.
- Autocomplete supports arrow keys, Enter selection, Escape, accessible expanded/listbox state, visible year and scrollable options. Submit button is distinct.
- Enter in a nonempty answer field submits when the suggestion list is closed; if open, Enter selects only. Keyboard shortcuts never trigger inside another interactive control.
- Feedback uses aria-live polite, preserves input after errors, avoids color-only meaning. Focus reveal heading on terminal round; focus next question heading on advance. Poster alt text before reveal is generic and contains no title.
- Animations 150–250ms for clue changes; respect prefers-reduced-motion. No flashing, continuous confetti, mandatory sound or autoplay video.
- Quit confirmation explains progress is resumable for 24h. Refresh rehydrates server state, not a new question. Completed result is appended to local stats exactly once using sessionId.
- Test 360×800, 390×844, 768px, 1440px; at 320px layout must still reflow. Manual Safari/iOS keyboard check remains a launch item even if Playwright uses WebKit.

Sample English copy: Start guessing; Reveal hint (−20 potential points); Skip movie (0 points); Not quite. 2 attempts left.; More than one movie has this title. Choose the year.; We couldn't load this clue. Your attempts haven't changed.; Not enough movies for this combination. Try another mode or level.

### 13.1 Required design workflow — UI UX Pro Max

Use UI UX Pro Max for ReelClue UI design and implementation, as requested by Andre. Official sources: https://www.uupm.cc/ and https://github.com/nextlevelbuilder/ui-ux-pro-max-skill. The detailed, reproducible installation and usage guide is `docs/UI-SKILL-SETUP.md`.

**Ownership:** RC-002 verifies Node/npm and Python 3, installs/configures the OpenCode integration, records its version and checks the local search helper. RC-003 uses that integration to produce `design-system/reelclue/MASTER.md` and maps the reviewed choices into Tailwind/shadcn semantic tokens. RC-023 audits the delivered UI against this baseline. No installation or generated design output is claimed by this PRD update.

**OpenCode installation:** the current official npm package is `ui-ux-pro-max-cli`, exposing the `uipro` command. The local setup sequence is:

```bash
npm install -g ui-ux-pro-max-cli
# Run inside the ReelClue repository root.
uipro init --ai opencode --dry-run
uipro init --ai opencode
```

Python 3 is required for the search helper; detect the machine's working interpreter (`python3`, `python`, or Windows `py -3`). The expected OpenCode skill is `.opencode/skills/ui-ux-pro-max/SKILL.md`, with the helper in its `scripts/search.py`. Read the installed instructions and validate discovery/execution in the actual OpenCode environment. Missing prerequisites are a reported blocker, not a reason to silently install OS software.

**Design deliverable:** generate a product-focused cinema-quiz recommendation, verify its relevance, then persist a candidate with an explicit project-root output directory. Use focused guidance for the actual `nextjs`, `shadcn` and `html-tailwind` stacks when relevant. Record selected colors, fonts, spacing, radii, states, effects, anti-patterns and rationale. The dark/amber direction above is the initial brief; material changes are reviewed in RC-003. Existing Master/page decisions must be read before updates and must not be blindly overwritten with `--force`.

**Reuse:** subsequent UI tickets read the approved Master plus relevant `design-system/reelclue/pages/<page>.md` override, use one semantic token system, and include screenshot/interaction evidence. Small fixes use targeted guidance rather than regenerating the whole theme. Skill output is a recommendation, not verified accessibility compliance and not authorization to change the stack, gameplay rules, dependencies or review gate.

## 14. Results and local statistics

Results show score/max for selected level, correct/10, accuracy, hints, mode, level, and 10 round outcomes. Accuracy is correct rounds /10, independent of attempts. No claim that a high score certifies film expertise. Reveal poster/title/year on missed rounds as discovery value. Primary CTA Play again; secondary Change settings and View stats.

Store local schema version, completed session IDs (bounded 100), recent movie IDs (bounded 30), aggregate games/accuracy/best score keyed by level+mode, preferences and last active session ID. Never store secrets, accepted aliases, or unrevealed future rounds. Handle unavailable storage, corrupted JSON, version migration and quota failures gracefully; game remains playable. Clearing local stats does not delete active server session; provide a separate end-session/forget-browser instruction if needed. Local stats are per browser and can be edited by the user; do not use them as an authoritative leaderboard.

## 15. Credentials and configuration

The owner supplied an API Read Access Token and an API Key in chat. Their literal values are deliberately not reproduced in this PRD, GitHub Issues, README, PRs or `.env.example`. Store them in the owner's untracked `.env.local` or hosting secret settings. The token is the preferred credential; both are not required together.

```dotenv
# .env.local (untracked) — replace placeholders privately
TMDB_READ_ACCESS_TOKEN=replace_privately
# Optional alternative; leave empty when Bearer token is configured
TMDB_API_KEY=
TMDB_API_BASE_URL=https://api.themoviedb.org/3
SUPABASE_URL=replace_privately
SUPABASE_SECRET_KEY=replace_privately
APP_BASE_URL=http://localhost:3000
RATE_LIMIT_HASH_SECRET=generate_random_secret_privately
```

Use `SUPABASE_SECRET_KEY` for the current server secret key type; if the owner's existing project uses a legacy service_role key, support it through an explicitly documented server-only fallback. Neither is a browser publishable key. No credential is prefixed `NEXT_PUBLIC_`. `.env*` are ignored except `.env.example`. Do not use API keys in query URLs/logs when Bearer is available. Validate required configuration at startup/server module initialization with helpful messages that do not echo values. Do not fetch or validate the owner's real TMDB token while drafting this plan; live integration validation belongs to the implementation ticket.

## 16. Reliability, abuse control, and observability

Initial configurable limits (hypotheses to tune): session creation 10/10min/browser and 30/10min/IP hash, search 60/min/browser, game mutations 60/min/browser, poster 120/min/browser; apply a broader IP backstop to expensive routes. Use atomic Postgres bucket increments so limits work across Vercel instances, not in-memory counters. Store keyed HMAC IP bucket identifiers, not raw IP; trust only hosting-provided forwarding headers and document the deployment assumption. Expire buckets in ≤24h. Return 429 without consuming state; avoid per-user isolation mistakes behind shared NAT.

Limit provider import concurrency and image sizes. Browser network timeouts have visible retry. Loading skeletons reserve space. Disable duplicate submit visually, but rely on transactions for correctness. The same session in two tabs yields a recoverable stale-state message.

Operational logs include request ID, route class, status, duration, provider status, catalog version and aggregate error code. Avoid raw guesses and full movie answers in telemetry. A lightweight health check must not reveal keys, DB schema, or answer catalog. If DB is unavailable, show service unavailable rather than allowing unverified local scoring. Offline play is not part of MVP.

## 17. Credits and provider requirements

About/Credits must display an approved TMDB logo with correct proportions and prominence below ReelClue, link to https://www.themoviedb.org, and display the required notice:

> This product uses the TMDB API but is not endorsed or certified by TMDB.

Treat this as a non-commercial playground. A future revenue-generating version requires checking the then-current TMDB commercial requirements before enabling ads or subscriptions. This document is not a substitute for the provider terms. Include brief text explaining movie metadata/artwork attribution and that clues may contain plot details. Do not show watch-provider data unless its additional attribution rules are covered in a later scope change.

## 18. Security and validation checklist

- No real credentials in git, issues, PR bodies, logs, bundles or screenshots.
- No clear answer, original poster URL, future movies or alias array in active-round HTML, RSC payload, JSON, alt text or metadata.
- Browser cannot choose the correct movie for a question or send its own score/attempts/hint stage.
- Ownership enforced on game, poster and result endpoints; RLS prevents direct browser catalog/session access.
- Origin, schema, request-size, image fetch and transaction boundaries covered by meaningful tests.
- Retry, simultaneous tabs, idempotency key collisions, out-of-order next and expired games covered.
- No hidden production writes in tests; provider test fixtures never call live TMDB from CI by default.

## 19. QA and definition of done

Meaningful automated coverage:
1. Difficulty score, ties, missing revenue, tier gates, excluded movies, and manual overrides.
2. Per-mode eligibility, missing metadata, title stage nesting, synopsis redaction, Mixed 2-per-mode assignment, shortage and no-repeat.
3. Unicode/diacritics/punctuation/ampersand, original/English aliases, ambiguous remakes, distinct sequels, duplicates and invalid submissions.
4. Score boundaries, skip, third wrong answer, hint cap, terminal locks, expiry, refresh and exactly-once result persistence.
5. SQL transaction behavior with concurrent identical/different actions; owner isolation and direct anon read denial in an isolated DB.
6. API errors/no-leak serialization; poster source allowlist, stage authorization and real transformed bytes.
7. Playwright: phone-size complete game, all five modes and Mixed, keyboard autocomplete, one refresh/resume, retry with same action ID, results/replay, unavailable storage and backend errors.

Every implementation PR must pass configured typecheck/lint/relevant tests/build. Add checks alongside features rather than postponing all tests to the final QA ticket. Final QA focuses on integration/regressions. UI PRs include phone and desktop screenshots, concise reproduction steps, changed behavior, AC checklist, and known limitations. No numerical test-coverage target is a substitute for rule verification.

**Launch acceptance:** all P0 AC pass, catalog coverage/calibration accepted by Andre, credentials configured privately, provider terms/credits checked, mobile keyboard manually checked, deployment preview tested, production environment set by owner, rollback runbook available. Deployment execution requires a separate instruction; the deployment ticket prepares it.

## 20. Delivery workflow — one ticket, one review, one merge

Andre is the final reviewer and merge decision maker. Work sequentially on one implementation ticket at a time.

1. Read current AGENTS.md, this PRD, the chosen GitHub issue, and the latest main branch. Check dependencies are merged and acceptance criteria are clear.
2. Set ticket In Progress when actually starting. If prerequisite is missing, leave it Backlog and document the blocker; do not call it complete.
3. Create `feat/rc-NNN-short-name` or `docs/rc-NNN-short-name` from latest main. Never implement on main or combine unrelated tickets.
4. Implement only that ticket, validate its meaningful behavior and run required checks.
5. Open a PR targeting main, include `Closes #N`, summary, validation evidence and manual review steps. Set ticket In Review only when reviewable.
6. STOP and give Andre the PR link. No self-merge, no auto-merge, and no starting the next implementation ticket before Andre approves and the current PR is merged.
7. If Andre requests changes, fix the same ticket/PR and rerun checks affected by those changes. Approval applies to the reviewed revision; new material changes require renewed review.
8. After an authorized merge, mark Done, sync main, then take the next instructed ticket. Passing CI alone never means Done.

Proposed board columns: Backlog → In Progress → In Review → Done. If the existing board uses different names, map semantics without deleting user configuration. WIP=1. Future/P1 work remains Backlog. Priority and dependency information must remain readable inside each issue even if custom Project fields are unavailable.

A minimal README-only initial commit is the sole repository bootstrap outside a PR, because GitHub requires a base branch for the first documentation PR. The complete PRD and agent rules are proposed on a documentation branch for Andre to review. This planning request authorizes backlog and documentation creation, not implementation or merging.

Branch protection/rulesets are recommended to require PRs and CI where the repository plan supports it. This plan does not claim those settings have been configured. Because the owner may author PRs, a GitHub self-review approval may not be possible; Andre's explicit review/merge decision remains the process gate.

## 21. Implementation structure

```text
src/app/                    pages and Route Handlers
src/components/ui/          shadcn primitives
src/features/game/          responsive game UI and reducer
src/features/catalog/       public catalog types only
src/lib/server/tmdb/         server-only provider client
src/lib/server/db/           server-only persistence and RPC wrappers
src/lib/server/game/         authoritative domain services
src/lib/game-rules/          pure eligibility/scoring/normalization functions
src/lib/contracts/           request and safe response schemas
config/catalog-overrides.json
scripts/catalog-sync.ts
scripts/purge-expired.ts
supabase/migrations/
tests/unit/ tests/integration/ tests/e2e/
docs/PRD-ReelClue.md
docs/BACKLOG.md
docs/OPENCODE-START.md
AGENTS.md
```

Do not create a barrel export that lets client modules import server credentials. Small domain modules and an explicit public DTO are more important than a large abstraction framework.

## 22. Ordered backlog

The complete issue scopes, acceptance criteria, dependency IDs, validation and actual GitHub links are recorded in `docs/BACKLOG.md`, and appended to the downloadable PRD package. RC-001 is this planning deliverable. RC-002 starts only after RC-001 review/merge. No ticket is already implemented by being listed here.

P0 delivery sequence: RC-001–RC-024. P1 future extensions: RC-025–RC-028. Dependencies may be a strict subset of earlier tickets, but the owner's one-ticket review gate still applies to the entire execution sequence.

## 23. Risks and decisions to revisit

| Risk | Decision / mitigation |
| --- | --- |
| Global vote counts differ from Indonesian familiarity | Manual calibration and future Indonesia-specific collection; do not label global data local evidence |
| Hard pool too small after quality gates | Report coverage, curate more eligible candidates; never silently lower the minimum audience floor |
| Hint or synopsis exposes title | Sanitizer and manual review; disable unsuitable clue eligibility |
| Poster contains readable title despite blur | Validate stages on phone; retain actual transformed pixels and tune sigma if necessary |
| Serverless concurrent requests double score | DB lock, revision, idempotency and state tests |
| Public anonymous endpoint abuse | Bounded distributed rate limits, quotas, no public import route, no leaderboard incentives |
| Free service quotas or pricing change | Verify selected hosting/database limits during deployment preparation; no fixed-free-cost promise |
| Small pilot creates misleading metrics | Show sample size and treat targets as hypotheses |
| All modes make first release too large | Deliver incrementally behind unavailable mode states; only call full MVP complete after all required modes work |

## 24. Official references checked on 4 November 2026

- TMDB application authentication: https://developer.themoviedb.org/docs/authentication-application
- TMDB popularity and trending: https://developer.themoviedb.org/docs/popularity-and-trending
- TMDB Discover filters: https://developer.themoviedb.org/reference/discover-movie
- TMDB movie credits: https://developer.themoviedb.org/reference/movie-credits
- TMDB alternative titles: https://developer.themoviedb.org/reference/movie-alternative-titles
- TMDB images: https://developer.themoviedb.org/reference/movie-images
- TMDB rate limiting: https://developer.themoviedb.org/docs/rate-limiting
- TMDB FAQ / attribution: https://developer.themoviedb.org/docs/faq
- Next.js environment variables: https://nextjs.org/docs/app/guides/environment-variables
- Next.js Route Handlers: https://nextjs.org/docs/app/api-reference/file-conventions/route
- Supabase API keys: https://supabase.com/docs/guides/getting-started/api-keys
- shadcn/ui Next.js setup: https://ui.shadcn.com/docs/installation/next
- UI UX Pro Max website: https://www.uupm.cc/
- UI UX Pro Max installation guide: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill#installation
- UI UX Pro Max OpenCode template: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/blob/main/src/ui-ux-pro-max/templates/platforms/opencode.json

Requirements, scores, thresholds, product targets and architecture in this document are proposed ReelClue decisions. Only provider behavior and requirements are sourced from the linked official references.
