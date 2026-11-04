# ReelClue — Ordered implementation backlog

Created 4 November 2026. 28 actual repository issues: 24 P0/MVP and 4 P1/future.

**Project placement:** pending; repository issues were created successfully, but the current GitHub integration has no Projects item/field mutation capability. Do not interpret issue creation as successful addition to Project #7.

**Execution gate:** one issue → one branch → one PR → Andre review → authorized merge. WIP=1. RC-001 is prepared for review; all implementation work is unstarted.

| Order | Issue | Priority | Dependencies |
| --- | --- | --- | --- |
| RC-001 | [#1 — PRD, backlog and review workflow baseline](https://github.com/andresanjaya/reelclue/issues/1) | P0 | None |
| RC-002 | [#2 — Bootstrap Next.js TypeScript and CI](https://github.com/andresanjaya/reelclue/issues/2) | P0 | RC-001 |
| RC-003 | [#3 — Create responsive UI foundations and game components](https://github.com/andresanjaya/reelclue/issues/3) | P0 | RC-002 |
| RC-004 | [#4 — Add Supabase catalog and anonymous-session schema](https://github.com/andresanjaya/reelclue/issues/4) | P0 | RC-002 |
| RC-005 | [#5 — Build server-only TMDB provider adapter](https://github.com/andresanjaya/reelclue/issues/5) | P0 | RC-002 |
| RC-006 | [#6 — Implement staged catalog import and quality report](https://github.com/andresanjaya/reelclue/issues/6) | P0 | RC-004, RC-005 |
| RC-007 | [#7 — Implement familiarity tiers and curated overrides](https://github.com/andresanjaya/reelclue/issues/7) | P0 | RC-006 |
| RC-008 | [#8 — Implement anonymous game lifecycle and atomic actions](https://github.com/andresanjaya/reelclue/issues/8) | P0 | RC-004, RC-007 |
| RC-009 | [#9 — Add answer normalization validation and scoring](https://github.com/andresanjaya/reelclue/issues/9) | P0 | RC-008 |
| RC-010 | [#10 — Add catalog search and accessible answer autocomplete](https://github.com/andresanjaya/reelclue/issues/10) | P0 | RC-003, RC-009 |
| RC-011 | [#11 — Build home and game setup flow](https://github.com/andresanjaya/reelclue/issues/11) | P0 | RC-003, RC-008 |
| RC-012 | [#12 — Build responsive gameplay shell and recovery states](https://github.com/andresanjaya/reelclue/issues/12) | P0 | RC-010, RC-011 |
| RC-013 | [#13 — Implement Poster Blur image pipeline and mode](https://github.com/andresanjaya/reelclue/issues/13) | P0 | RC-005, RC-012 |
| RC-014 | [#14 — Implement Missing Title mode with deterministic reveals](https://github.com/andresanjaya/reelclue/issues/14) | P0 | RC-012 |
| RC-015 | [#15 — Implement sanitized Synopsis mode](https://github.com/andresanjaya/reelclue/issues/15) | P0 | RC-012 |
| RC-016 | [#16 — Implement Director and Cast mode](https://github.com/andresanjaya/reelclue/issues/16) | P0 | RC-012 |
| RC-017 | [#17 — Implement Genre Detective mode](https://github.com/andresanjaya/reelclue/issues/17) | P0 | RC-012 |
| RC-018 | [#18 — Implement balanced Mixed sessions](https://github.com/andresanjaya/reelclue/issues/18) | P0 | RC-013, RC-014, RC-015, RC-016, RC-017 |
| RC-019 | [#19 — Build results and replay experience](https://github.com/andresanjaya/reelclue/issues/19) | P0 | RC-018 |
| RC-020 | [#20 — Add local stats preferences and session resume](https://github.com/andresanjaya/reelclue/issues/20) | P0 | RC-019 |
| RC-021 | [#21 — Add About credits privacy and movie attribution](https://github.com/andresanjaya/reelclue/issues/21) | P0 | RC-003, RC-019 |
| RC-022 | [#22 — Harden rate limits errors retention and observability](https://github.com/andresanjaya/reelclue/issues/22) | P0 | RC-020, RC-021 |
| RC-023 | [#23 — Run integrated mobile accessibility and game regression QA](https://github.com/andresanjaya/reelclue/issues/23) | P0 | RC-022 |
| RC-024 | [#24 — Prepare deployment preview and release runbook](https://github.com/andresanjaya/reelclue/issues/24) | P0 | RC-023 |
| RC-025 | [#25 — Add Daily Challenge with stable daily puzzle](https://github.com/andresanjaya/reelclue/issues/25) | P1 | RC-024 |
| RC-026 | [#26 — Add spoiler-free result sharing](https://github.com/andresanjaya/reelclue/issues/26) | P1 | RC-024 |
| RC-027 | [#27 — Add installable PWA with honest offline state](https://github.com/andresanjaya/reelclue/issues/27) | P1 | RC-024 |
| RC-028 | [#28 — Research and add a calibrated Indonesian movie collection](https://github.com/andresanjaya/reelclue/issues/28) | P1 | RC-024 |

## Full ticket specifications

### [RC-001] PRD, backlog and review workflow baseline

GitHub: https://github.com/andresanjaya/reelclue/issues/1

#### Outcome

Approve a single product baseline and the mandatory review gate before implementation.

#### Planning

- Ticket: RC-001
- Priority: P0
- Release: MVP
- Initial status: Backlog
- Dependencies: None
- Source of truth: docs/PRD-ReelClue.md on documentation PR, then main after approval

#### Scope

- Commit the PRD, ordered backlog, AGENTS.md, environment example and OpenCode starter prompt on a documentation branch.
- Keep application credentials out of documents, issues and committed environment files.

#### Acceptance criteria

- [ ] PRD covers all five clue types plus Mixed, fairness tiers, mobile UX, APIs, persistence, QA and scope.
- [ ] Every planned ticket has scope, acceptance criteria, dependencies and validation.
- [ ] A documentation PR targets main; it remains open for Andre to review.

#### Validation

Review document links, dependency order, secret placeholders and the documentation-only diff.

#### Review and merge gate

One ticket = one branch = one PR. Branch from latest main only after dependencies are merged. Include this issue in the PR, validation evidence and manual review steps. Stop in In Review and send the PR to Andre. No self-merge or auto-merge. Do not begin the next implementation ticket until Andre reviews and this PR is merged. Mark Done only after merge. For RC-001, this planning request authorizes document preparation only.

### [RC-002] Bootstrap Next.js TypeScript and CI

GitHub: https://github.com/andresanjaya/reelclue/issues/2

#### Outcome

Create a reproducible base that subsequent features can build on.

#### Planning

- Ticket: RC-002
- Priority: P0
- Release: MVP
- Initial status: Backlog
- Dependencies: RC-001
- Source of truth: docs/PRD-ReelClue.md on documentation PR, then main after approval

#### Scope

- Initialize supported stable Next.js App Router with TypeScript strict, pnpm, Tailwind and ESLint.
- Add Zod env scaffolding, unit test setup and GitHub Actions for lint/typecheck/test/build; configure Node/pnpm versions and lockfile.

#### Acceptance criteria

- [ ] Fresh install and all CI commands pass with documented placeholder/test configuration.
- [ ] No production credentials required in CI; .env.local is ignored and .env.example tracked.
- [ ] Home placeholder renders on phone and desktop without introducing gameplay.

#### Validation

Run clean pnpm install --frozen-lockfile, lint, typecheck, test and build; inspect generated bundle and env handling.

#### UI skill setup — UI UX Pro Max

Source: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
Website: https://www.uupm.cc/

- Check Node/npm and Python 3 availability. Document interpreter names for Windows (py -3/python) and macOS/Linux (python3). Missing prerequisites are a reported setup blocker, not permission to change the owner's operating system.
- Follow docs/UI-SKILL-SETUP.md: install the current official npm package ui-ux-pro-max-cli (command uipro), preview project changes, then initialize this repository with uipro init --ai opencode. Keep this as development tooling, not an application/runtime dependency.
- Record the CLI version and generated integration paths. Confirm .opencode/skills/ui-ux-pro-max/SKILL.md and its scripts/data exist, read the installed instructions, and verify search.py --help with the detected Python interpreter.
- Preserve existing agent rules and generated-file licensing. No design-system generation or gameplay implementation in RC-002; product UI foundations belong to RC-003.

##### Additional acceptance criteria

- [ ] OpenCode can discover ui-ux-pro-max in this repository; the installed Python search helper is runnable.
- [ ] The README/runbook records reproducible install/verification commands and actual CLI version; no real credentials or machine-specific paths are committed.
- [ ] Package identity is ui-ux-pro-max-cli; no stale uipro-cli install instruction is used.

##### Additional validation

Capture version/help and generated-path checks. Installation instructions are not evidence that installation was performed; report actual results or the concrete blocker.

#### Review and merge gate

One ticket = one branch = one PR. Branch from latest main only after dependencies are merged. Include this issue in the PR, validation evidence and manual review steps. Stop in In Review and send the PR to Andre. No self-merge or auto-merge. Do not begin the next implementation ticket until Andre reviews and this PR is merged. Mark Done only after merge. For RC-001, this planning request authorizes document preparation only.

### [RC-003] Create responsive UI foundations and game components

GitHub: https://github.com/andresanjaya/reelclue/issues/3

#### Outcome

Establish consistent controls, spacing and mobile behavior.

#### Planning

- Ticket: RC-003
- Priority: P0
- Release: MVP
- Initial status: Backlog
- Dependencies: RC-002
- Source of truth: docs/PRD-ReelClue.md on documentation PR, then main after approval

#### Scope

- Set semantic dark/amber tokens, typography and a 4px spacing scale.
- Install only relevant shadcn primitives; build labelled mode card, level selector, game header, feedback, skeleton and accessible combobox foundation.

#### Acceptance criteria

- [ ] Controls meet 44px touch target and 16px input baseline; visible keyboard focus and reduced-motion support.
- [ ] Layouts reflow at 320/360/390/768/1440px; no horizontal scroll.
- [ ] No gameplay logic or placeholder controls presented as working features.

#### Validation

Keyboard/tab and contrast checks; phone and desktop screenshots; component interaction tests only for custom behavior.

#### Required UI workflow — UI UX Pro Max

Use the OpenCode installation from RC-002 and docs/UI-SKILL-SETUP.md before selecting or implementing ReelClue UI foundations.

- Read the installed SKILL.md and inspect actual Next.js/Tailwind/shadcn versions.
- Run a focused design-system query for ReelClue's mobile movie-quiz context. Review that its recommendations fit a playful cinema game; retry a narrower query once if unrelated and report unmatched output honestly.
- Persist the reviewed baseline to design-system/reelclue/MASTER.md with explicit project-root output. Document chosen semantic colors, typography, spacing, radii, interaction states, mobile patterns, anti-patterns and rationale.
- Use separate focused searches for the detected nextjs, shadcn and html-tailwind stacks as needed. Keep the PRD's dark/amber direction as the initial brief; substantive changes must be explained in this reviewable PR.
- Map recommendations into one existing Tailwind/shadcn semantic token system. All later UI tickets read this Master and relevant page overrides; do not create a second styling system or force unrelated libraries/GSAP.

##### Additional acceptance criteria

- [ ] Skill setup is verified; relevant searches and recommendation-fit review are recorded without private data.
- [ ] design-system/reelclue/MASTER.md contains a coherent reviewed ReelClue baseline and is included in this PR for Andre's approval.
- [ ] UI components consume approved semantic tokens; mobile touch/keyboard, contrast, wrapping and reduced-motion checks pass.
- [ ] Existing Master/page decisions are preserved; no --force overwrite or product-scope expansion occurs automatically.

##### Additional validation

Include design-system output paths and query/rationale summary, semantic-token mapping, phone/desktop screenshots, and the UI quality checklist in docs/UI-SKILL-SETUP.md. Do not present generated recommendations as tested accessibility compliance.

#### Review and merge gate

One ticket = one branch = one PR. Branch from latest main only after dependencies are merged. Include this issue in the PR, validation evidence and manual review steps. Stop in In Review and send the PR to Andre. No self-merge or auto-merge. Do not begin the next implementation ticket until Andre reviews and this PR is merged. Mark Done only after merge. For RC-001, this planning request authorizes document preparation only.

### [RC-004] Add Supabase catalog and anonymous-session schema

GitHub: https://github.com/andresanjaya/reelclue/issues/4

#### Outcome

Persist authoritative game state safely across server instances.

#### Planning

- Ticket: RC-004
- Priority: P0
- Release: MVP
- Initial status: Backlog
- Dependencies: RC-002
- Source of truth: docs/PRD-ReelClue.md on documentation PR, then main after approval

#### Scope

- Add versioned SQL migrations for PRD entities, FK/check/unique constraints, ownership token hashes and session-create action uniqueness.
- Enable RLS with no browser access; restrict privileged RPC execution; server-only DB client; isolated fixture seed and purge command.

#### Acceptance criteria

- [ ] Migrations apply to an empty isolated database and report catalog version/coverage.
- [ ] Anonymous and browser authenticated roles cannot read catalog answers, sessions or execute privileged RPCs.
- [ ] Secrets never enter client code; retention cleanup preserves active referenced catalog versions.
- [ ] Integration harness uses an isolated test database and never production.

#### Validation

Apply migrations; test FK/check uniqueness, anon denial, RPC permissions and cleanup on seeded expired records.

#### Review and merge gate

One ticket = one branch = one PR. Branch from latest main only after dependencies are merged. Include this issue in the PR, validation evidence and manual review steps. Stop in In Review and send the PR to Andre. No self-merge or auto-merge. Do not begin the next implementation ticket until Andre reviews and this PR is merged. Mark Done only after merge. For RC-001, this planning request authorizes document preparation only.

### [RC-005] Build server-only TMDB provider adapter

GitHub: https://github.com/andresanjaya/reelclue/issues/5

#### Outcome

Retrieve typed movie data with bounded, recoverable provider calls.

#### Planning

- Ticket: RC-005
- Priority: P0
- Release: MVP
- Initial status: Backlog
- Dependencies: RC-002
- Source of truth: docs/PRD-ReelClue.md on documentation PR, then main after approval

#### Scope

- Use server-only Bearer token with optional API Key alternative; typed configuration/discover/details/credits/aliases/images adapters.
- Validate payloads; 8s timeout, bounded concurrency, transient retries and 429 handling; injectable fake provider.

#### Acceptance criteria

- [ ] Missing credential errors are helpful without echoing values.
- [ ] 401/403/404 do not retry; transient failures retry at most twice with jitter/Retry-After handling.
- [ ] Provider data and tokens are not serialized to browser or logged.
- [ ] Tests run without real TMDB credentials.

#### Validation

Mock successful, malformed, unauthorized, 429, timeout and 5xx responses; owner-configured live smoke check only when available.

#### Review and merge gate

One ticket = one branch = one PR. Branch from latest main only after dependencies are merged. Include this issue in the PR, validation evidence and manual review steps. Stop in In Review and send the PR to Andre. No self-merge or auto-merge. Do not begin the next implementation ticket until Andre reviews and this PR is merged. Mark Done only after merge. For RC-001, this planning request authorizes document preparation only.

### [RC-006] Implement staged catalog import and quality report

GitHub: https://github.com/andresanjaya/reelclue/issues/6

#### Outcome

Prepare a bounded usable movie pool before gameplay.

#### Planning

- Ticket: RC-006
- Priority: P0
- Release: MVP
- Initial status: Backlog
- Dependencies: RC-004, RC-005
- Source of truth: docs/PRD-ReelClue.md on documentation PR, then main after approval

#### Scope

- Implement catalog:sync dry-run/apply using bounded discover slices, deduplication and enrichment.
- Apply base eligibility and mode metadata flags; sanitize source text; stage version and atomically activate only after coverage validation; retain previous version on failure.

#### Acceptance criteria

- [ ] Excludes adult/video/unreleased/recent/short-runtime/<500-vote entries.
- [ ] Dry-run writes no active catalog; report shows counts and rejection reasons by tier/mode once tiering is integrated.
- [ ] Missing metadata only disables affected modes; no invented cast, aliases, dates or text.
- [ ] Sync has no public endpoint; fixtures are marked and cannot activate as production data.

#### Validation

Fake-provider integration test for dedupe, metadata gaps, failed import rollback and activation; review bounded API call count.

#### Review and merge gate

One ticket = one branch = one PR. Branch from latest main only after dependencies are merged. Include this issue in the PR, validation evidence and manual review steps. Stop in In Review and send the PR to Andre. No self-merge or auto-merge. Do not begin the next implementation ticket until Andre reviews and this PR is merged. Mark Done only after merge. For RC-001, this planning request authorizes document preparation only.

### [RC-007] Implement familiarity tiers and curated overrides

GitHub: https://github.com/andresanjaya/reelclue/issues/7

#### Outcome

Make Hard mean established hidden gems instead of random obscure movies.

#### Planning

- Ticket: RC-007
- Priority: P0
- Release: MVP
- Initial status: Backlog
- Dependencies: RC-006
- Source of truth: docs/PRD-ReelClue.md on documentation PR, then main after approval

#### Scope

- Implement versioned percentile score, optional revenue weights and deterministic band assignment per PRD.
- Validate tier gates and reviewed overrides; produce coverage report and calibration checklist for Andre.

#### Acceptance criteria

- [ ] Easy/Medium/Hard disjoint with specified vote gates; Hard rating >=7 and 500–9999 votes.
- [ ] Missing/zero revenue is unknown and reweights score rather than lowering familiarity.
- [ ] Overrides require reason/reviewer/date and cannot bypass base or Hard gates; conflicts fail loudly.
- [ ] Coverage target is >=100/tier and >=30/mode/tier; shortages do not silently lower thresholds.

#### Validation

Unit cases for ties, one-item ranks, missing revenue, gates, override conflicts and exclusions; review 10 sampled movies per tier with Andre.

#### Review and merge gate

One ticket = one branch = one PR. Branch from latest main only after dependencies are merged. Include this issue in the PR, validation evidence and manual review steps. Stop in In Review and send the PR to Andre. No self-merge or auto-merge. Do not begin the next implementation ticket until Andre reviews and this PR is merged. Mark Done only after merge. For RC-001, this planning request authorizes document preparation only.

### [RC-008] Implement anonymous game lifecycle and atomic actions

GitHub: https://github.com/andresanjaya/reelclue/issues/8

#### Outcome

Create, resume and advance one authoritative ten-round game.

#### Planning

- Ticket: RC-008
- Priority: P0
- Release: MVP
- Initial status: Backlog
- Dependencies: RC-004, RC-007
- Source of truth: docs/PRD-ReelClue.md on documentation PR, then main after approval

#### Scope

- Issue hashed random browser token cookie; own every game read/mutation by cookie identity.
- Select 10 unique eligible movies, freeze versions, persist per-round seeds and safe DTOs.
- Implement transactional action envelope with idempotency, revision checks, expiry, skip, hint and next transitions; guess outcomes are wired in RC-009.

#### Acceptance criteria

- [ ] Duplicate create action returns same game; repeated mutation never changes attempts/points twice.
- [ ] Wrong owner cannot access game; stale/out-of-order/expired/terminal actions return documented errors.
- [ ] No future answers/aliases/movie IDs in active-round DTO; no shared cache.
- [ ] Insufficient eligible pool returns a typed unavailable response; no shorter games.

#### Validation

Isolated DB tests for race conditions, retries, action ID payload conflict, ownership, 24h expiry, refresh and next/skip/hint boundaries.

#### Review and merge gate

One ticket = one branch = one PR. Branch from latest main only after dependencies are merged. Include this issue in the PR, validation evidence and manual review steps. Stop in In Review and send the PR to Andre. No self-merge or auto-merge. Do not begin the next implementation ticket until Andre reviews and this PR is merged. Mark Done only after merge. For RC-001, this planning request authorizes document preparation only.

### [RC-009] Add answer normalization validation and scoring

GitHub: https://github.com/andresanjaya/reelclue/issues/9

#### Outcome

Judge intended movie identity fairly and calculate points once.

#### Planning

- Ticket: RC-009
- Priority: P0
- Release: MVP
- Initial status: Backlog
- Dependencies: RC-008
- Source of truth: docs/PRD-ReelClue.md on documentation PR, then main after approval

#### Scope

- Implement canonical/original/approved-alias normalization and remake ambiguity handling.
- Wire typed guesses and choice-handle identities into transactional outcomes; attempt rules, hint penalties and terminal reveal.

#### Acceptance criteria

- [ ] Numbers/sequels remain distinct; Unicode, punctuation and ampersands follow PRD.
- [ ] Ambiguous title requests year selection without consuming attempt; selected remake judged by movie identity.
- [ ] Blank/invalid/duplicate wrong guesses and failed requests consume no attempt.
- [ ] Third wrong answer or skip ends round; correct score formula and terminal lock enforced server-side.

#### Validation

Unit normalization/scoring boundary matrix plus DB integration for double submits, 0-point correct answers, skips and third wrong answer.

#### Review and merge gate

One ticket = one branch = one PR. Branch from latest main only after dependencies are merged. Include this issue in the PR, validation evidence and manual review steps. Stop in In Review and send the PR to Andre. No self-merge or auto-merge. Do not begin the next implementation ticket until Andre reviews and this PR is merged. Mark Done only after merge. For RC-001, this planning request authorizes document preparation only.

### [RC-010] Add catalog search and accessible answer autocomplete

GitHub: https://github.com/andresanjaya/reelclue/issues/10

#### Outcome

Help mobile players submit intended titles without leaking session answers.

#### Planning

- Ticket: RC-010
- Priority: P0
- Release: MVP
- Initial status: Backlog
- Dependencies: RC-003, RC-009
- Source of truth: docs/PRD-ReelClue.md on documentation PR, then main after approval

#### Scope

- Build same-origin catalog search with minimum 2 characters, 300ms debounce, cancellation and max 8 title/year choices.
- Use opaque choice handles and accessible combobox; selecting does not submit; free text remains supported.

#### Acceptance criteria

- [ ] Search spans curated catalog rather than only current answers and exposes no answer/membership flag.
- [ ] Arrow keys/Enter/Escape, screen-reader labels and mobile keyboard work.
- [ ] Stale responses never replace newer query results; empty/loading/error states clear.
- [ ] Same-title results show years; server validates selected choice identity.

#### Validation

Component tests for keyboard/debounce/races; API serialization validation and mobile suggestion-list check.

#### Review and merge gate

One ticket = one branch = one PR. Branch from latest main only after dependencies are merged. Include this issue in the PR, validation evidence and manual review steps. Stop in In Review and send the PR to Andre. No self-merge or auto-merge. Do not begin the next implementation ticket until Andre reviews and this PR is merged. Mark Done only after merge. For RC-001, this planning request authorizes document preparation only.

### [RC-011] Build home and game setup flow

GitHub: https://github.com/andresanjaya/reelclue/issues/11

#### Outcome

Let players understand modes and begin with minimal friction.

#### Planning

- Ticket: RC-011
- Priority: P0
- Release: MVP
- Initial status: Backlog
- Dependencies: RC-003, RC-008
- Source of truth: docs/PRD-ReelClue.md on documentation PR, then main after approval

#### Scope

- Create home, concise How to Play, mode cards and /play setup with selected mode and difficulty.
- Default Poster Blur/Easy, one explicit Start action, preserve choices on retry and replay; disable unavailable modes until implemented.

#### Acceptance criteria

- [ ] Home mode cards preselect intended mode; defaults visible and accessible.
- [ ] Start double-tap creates one session, navigates only on success, and shows recoverable failure.
- [ ] Unavailable mode/level combinations explain catalog shortage without changing player selection.
- [ ] No login wall and no timer in MVP.

#### Validation

Phone/desktop flow review; double-click/retry integration check; keyboard setup and validation cases.

#### Review and merge gate

One ticket = one branch = one PR. Branch from latest main only after dependencies are merged. Include this issue in the PR, validation evidence and manual review steps. Stop in In Review and send the PR to Andre. No self-merge or auto-merge. Do not begin the next implementation ticket until Andre reviews and this PR is merged. Mark Done only after merge. For RC-001, this planning request authorizes document preparation only.

### [RC-012] Build responsive gameplay shell and recovery states

GitHub: https://github.com/andresanjaya/reelclue/issues/12

#### Outcome

Provide a stable place for every clue renderer and answer interaction.

#### Planning

- Ticket: RC-012
- Priority: P0
- Release: MVP
- Initial status: Backlog
- Dependencies: RC-010, RC-011
- Source of truth: docs/PRD-ReelClue.md on documentation PR, then main after approval

#### Scope

- Render progress, level, score, attempts, clue area, answer box, hints and skip confirmation.
- Use safe server DTO and UI reducer; implement loading/submitting/reveal/advancing/error/expired states and refresh/resume.

#### Acceptance criteria

- [ ] No competing actions during writes; action retry reuses ID; stale state is recoverable.
- [ ] Virtual keyboard and safe-area layout do not cover suggestions or controls.
- [ ] Terminal reveal waits for Next; quit confirmation explains resumability.
- [ ] Generic poster alt and page metadata never disclose active answer.

#### Validation

Phone keyboard manual check; reducer/interaction tests for retries/focus; inspect HTML/RSC/JSON for accidental answer leakage.

#### Review and merge gate

One ticket = one branch = one PR. Branch from latest main only after dependencies are merged. Include this issue in the PR, validation evidence and manual review steps. Stop in In Review and send the PR to Andre. No self-merge or auto-merge. Do not begin the next implementation ticket until Andre reviews and this PR is merged. Mark Done only after merge. For RC-001, this planning request authorizes document preparation only.

### [RC-013] Implement Poster Blur image pipeline and mode

GitHub: https://github.com/andresanjaya/reelclue/issues/13

#### Outcome

Offer a real blurred-poster guessing experience with progressive clarity.

#### Planning

- Ticket: RC-013
- Priority: P0
- Release: MVP
- Initial status: Backlog
- Dependencies: RC-005, RC-012
- Source of truth: docs/PRD-ReelClue.md on documentation PR, then main after approval

#### Scope

- Add Node/Sharp allowlisted image fetch and 300x450 transformed stages sigma 24/16/8.
- Authorize current round/stage from cookie; hint 3 supplies year/genre; terminal reveal exposes original poster only after round ends.

#### Acceptance criteria

- [ ] Browser receives transformed pixels rather than a clear image with CSS blur.
- [ ] No original poster path/title in active response or alt; stage manipulation cannot reveal clearer future image.
- [ ] Source byte/pixel/timeout/redirect/host limits enforced; missing images excluded or replaced through valid server recovery.
- [ ] Image and API failures leave attempts/score unchanged; retries usable on phone.

#### Validation

Image-byte transformation checks, stage/owner authorization and source limit tests; manual recognizability check on mobile.

#### Review and merge gate

One ticket = one branch = one PR. Branch from latest main only after dependencies are merged. Include this issue in the PR, validation evidence and manual review steps. Stop in In Review and send the PR to Andre. No self-merge or auto-merge. Do not begin the next implementation ticket until Andre reviews and this PR is merged. Mark Done only after merge. For RC-001, this planning request authorizes document preparation only.

### [RC-014] Implement Missing Title mode with deterministic reveals

GitHub: https://github.com/andresanjaya/reelclue/issues/14

#### Outcome

Turn incomplete movie titles into a fair word puzzle.

#### Planning

- Ticket: RC-014
- Priority: P0
- Release: MVP
- Initial status: Backlog
- Dependencies: RC-012
- Source of truth: docs/PRD-ReelClue.md on documentation PR, then main after approval

#### Scope

- Use grapheme-aware masking, preserve punctuation/spaces, seeded nested reveal order and PRD fractions.
- Exclude titles with <5 maskable characters and never reveal final hidden character via hint.

#### Acceptance criteria

- [ ] 35/50/65/80% stages follow formula and remain identical after refresh.
- [ ] Previously revealed characters never disappear; entire title never shown before round ends.
- [ ] Long titles wrap cleanly at 320px; Unicode input and graphemes render correctly.

#### Validation

Deterministic seed/stage and Unicode unit tests; mobile screenshots for long, punctuated and non-Latin titles.

#### Review and merge gate

One ticket = one branch = one PR. Branch from latest main only after dependencies are merged. Include this issue in the PR, validation evidence and manual review steps. Stop in In Review and send the PR to Andre. No self-merge or auto-merge. Do not begin the next implementation ticket until Andre reviews and this PR is merged. Mark Done only after merge. For RC-001, this planning request authorizes document preparation only.

### [RC-015] Implement sanitized Synopsis mode

GitHub: https://github.com/andresanjaya/reelclue/issues/15

#### Outcome

Let players infer films from descriptions without direct title leaks.

#### Planning

- Ticket: RC-015
- Priority: P0
- Release: MVP
- Initial status: Backlog
- Dependencies: RC-012
- Source of truth: docs/PRD-ReelClue.md on documentation PR, then main after approval

#### Scope

- Build Unicode-aware full-title/alias redaction and readable sentence clipping up to 600 chars.
- Implement decade, genre and director hints; flag unusable/over-redacted summaries and update eligibility.

#### Acceptance criteria

- [ ] Canonical/original/approved multiword aliases are removed from visible clue and hidden UI fields.
- [ ] Short/common aliases do not cause destructive word-by-word redaction; unusable clue excluded.
- [ ] Missing synopsis/director/genre fails eligibility; no AI summaries or invented details.
- [ ] Clue remains readable on mobile and hint stages match server state.

#### Validation

Redaction boundary/diacritic/HTML/common-word tests and manual review of sampled summaries; inspect safe response.

#### Review and merge gate

One ticket = one branch = one PR. Branch from latest main only after dependencies are merged. Include this issue in the PR, validation evidence and manual review steps. Stop in In Review and send the PR to Andre. No self-merge or auto-merge. Do not begin the next implementation ticket until Andre reviews and this PR is merged. Mark Done only after merge. For RC-001, this planning request authorizes document preparation only.

### [RC-016] Implement Director and Cast mode

GitHub: https://github.com/andresanjaya/reelclue/issues/16

#### Outcome

Use filmmaking people as progressive movie clues.

#### Planning

- Ticket: RC-016
- Priority: P0
- Release: MVP
- Initial status: Backlog
- Dependencies: RC-012
- Source of truth: docs/PRD-ReelClue.md on documentation PR, then main after approval

#### Scope

- Render director(s), then three billed cast hints in deterministic order; show year with hint 3.
- Require director and 3 distinct cast people; dedupe identities and handle co-directors.

#### Acceptance criteria

- [ ] Hints reveal no extra people early and persist on refresh.
- [ ] Early clue explains that multiple films can fit; only chosen movie identity accepted.
- [ ] Long names wrap; missing credits never appear as invented placeholders.

#### Validation

Eligibility and billed-order fixtures; co-director/deduplication tests; mobile and screen-reader review.

#### Review and merge gate

One ticket = one branch = one PR. Branch from latest main only after dependencies are merged. Include this issue in the PR, validation evidence and manual review steps. Stop in In Review and send the PR to Andre. No self-merge or auto-merge. Do not begin the next implementation ticket until Andre reviews and this PR is merged. Mark Done only after merge. For RC-001, this planning request authorizes document preparation only.

### [RC-017] Implement Genre Detective mode

GitHub: https://github.com/andresanjaya/reelclue/issues/17

#### Outcome

Make genre-based guessing possible with progressive distinguishing clues.

#### Planning

- Ticket: RC-017
- Priority: P0
- Release: MVP
- Initial status: Backlog
- Dependencies: RC-012
- Source of truth: docs/PRD-ReelClue.md on documentation PR, then main after approval

#### Scope

- Start with up to 3 genres and release decade, then original language, director, and cast/year.
- Enforce metadata requirements and use readable language/genre labels.

#### Acceptance criteria

- [ ] Genre alone is not represented as a unique identification; hints follow PRD.
- [ ] Missing metadata excludes the film; no auto-revealed title or original image.
- [ ] All clues accessible with text and responsive tags.

#### Validation

Eligibility/hint-stage tests, multiple-genre and long-label fixtures, phone gameplay check.

#### Review and merge gate

One ticket = one branch = one PR. Branch from latest main only after dependencies are merged. Include this issue in the PR, validation evidence and manual review steps. Stop in In Review and send the PR to Andre. No self-merge or auto-merge. Do not begin the next implementation ticket until Andre reviews and this PR is merged. Mark Done only after merge. For RC-001, this planning request authorizes document preparation only.

### [RC-018] Implement balanced Mixed sessions

GitHub: https://github.com/andresanjaya/reelclue/issues/18

#### Outcome

Combine all clue types in one balanced replayable game.

#### Planning

- Ticket: RC-018
- Priority: P0
- Release: MVP
- Initial status: Backlog
- Dependencies: RC-013, RC-014, RC-015, RC-016, RC-017
- Source of truth: docs/PRD-ReelClue.md on documentation PR, then main after approval

#### Scope

- Assign exactly 2 rounds per underlying mode, constrained pools first, bounded backtracking and frozen order.
- Reuse existing renderers without duplicating scoring or mode-specific game rules.

#### Acceptance criteria

- [ ] 10 distinct movies with 2 rounds per mode, even when pools overlap.
- [ ] Reload does not reshuffle assignments; same session versions stay frozen.
- [ ] Shortage after bounded search returns clear unavailability and no partial session.
- [ ] Recent-history exclusion relaxes only if needed, never core difficulty gates.

#### Validation

Deterministic assignment tests including heavily overlapping pools, impossible matching, exhaustion and replay history.

#### Review and merge gate

One ticket = one branch = one PR. Branch from latest main only after dependencies are merged. Include this issue in the PR, validation evidence and manual review steps. Stop in In Review and send the PR to Andre. No self-merge or auto-merge. Do not begin the next implementation ticket until Andre reviews and this PR is merged. Mark Done only after merge. For RC-001, this planning request authorizes document preparation only.

### [RC-019] Build results and replay experience

GitHub: https://github.com/andresanjaya/reelclue/issues/19

#### Outcome

Give a satisfying session outcome and clear next action.

#### Planning

- Ticket: RC-019
- Priority: P0
- Release: MVP
- Initial status: Backlog
- Dependencies: RC-018
- Source of truth: docs/PRD-ReelClue.md on documentation PR, then main after approval

#### Scope

- Build owned completed results page with score/max, accuracy, hints and all round outcomes.
- Render safe terminal movie details/TMDB links, replay with retained setup and return to settings.

#### Acceptance criteria

- [ ] Incomplete/foreign result requests rejected; completion is exactly once.
- [ ] All 10 outcomes match server score; no score recomputation trusted from client.
- [ ] Play again requires Start confirmation, has no duplicate session creation, and keeps context.
- [ ] Clear fallback for missing optional reveal metadata.

#### Validation

End-to-end full session and result ownership checks; points/accuracy calculation assertions; mobile result review.

#### Review and merge gate

One ticket = one branch = one PR. Branch from latest main only after dependencies are merged. Include this issue in the PR, validation evidence and manual review steps. Stop in In Review and send the PR to Andre. No self-merge or auto-merge. Do not begin the next implementation ticket until Andre reviews and this PR is merged. Mark Done only after merge. For RC-001, this planning request authorizes document preparation only.

### [RC-020] Add local stats preferences and session resume

GitHub: https://github.com/andresanjaya/reelclue/issues/20

#### Outcome

Remember lightweight progress on the same device without accounts.

#### Planning

- Ticket: RC-020
- Priority: P0
- Release: MVP
- Initial status: Backlog
- Dependencies: RC-019
- Source of truth: docs/PRD-ReelClue.md on documentation PR, then main after approval

#### Scope

- Version bounded local storage for recent movie IDs, completed result IDs, stats by mode/level, preferences and last session.
- Add stats screen and clear-history flow; support corrupt/blocked/quota storage without breaking play.

#### Acceptance criteria

- [ ] Refresh restores the owned server session rather than trusting local game state.
- [ ] Repeated visits append a result only once; limits 100 results/30 recent movie IDs enforced.
- [ ] Stats comparisons separated by difficulty/mode and labelled per-device.
- [ ] No secret, alias array or future round data stored locally.

#### Validation

Storage-unavailable/migration/corrupt/quota unit cases; refresh/results dedupe E2E; clear-history manual review.

#### Review and merge gate

One ticket = one branch = one PR. Branch from latest main only after dependencies are merged. Include this issue in the PR, validation evidence and manual review steps. Stop in In Review and send the PR to Andre. No self-merge or auto-merge. Do not begin the next implementation ticket until Andre reviews and this PR is merged. Mark Done only after merge. For RC-001, this planning request authorizes document preparation only.

### [RC-021] Add About credits privacy and movie attribution

GitHub: https://github.com/andresanjaya/reelclue/issues/21

#### Outcome

Explain the game and provide required TMDB attribution.

#### Planning

- Ticket: RC-021
- Priority: P0
- Release: MVP
- Initial status: Backlog
- Dependencies: RC-003, RC-019
- Source of truth: docs/PRD-ReelClue.md on documentation PR, then main after approval

#### Scope

- Build /about with approved TMDB logo/link and exact required non-endorsement notice.
- Explain clues/spoilers, familiarity proxies, per-browser stats, cookie retention, privacy and non-commercial scope.

#### Acceptance criteria

- [ ] TMDB attribution visible in About, logo proportions/colors approved and subordinate to ReelClue.
- [ ] No claims that popularity equals viewers or Hard proves a film is objectively underrated.
- [ ] Links accessible and target disclosures clear; no fake legal or product claims.

#### Validation

Check against current official TMDB FAQ/brand assets; keyboard/phone review and copy review.

#### Review and merge gate

One ticket = one branch = one PR. Branch from latest main only after dependencies are merged. Include this issue in the PR, validation evidence and manual review steps. Stop in In Review and send the PR to Andre. No self-merge or auto-merge. Do not begin the next implementation ticket until Andre reviews and this PR is merged. Mark Done only after merge. For RC-001, this planning request authorizes document preparation only.

### [RC-022] Harden rate limits errors retention and observability

GitHub: https://github.com/andresanjaya/reelclue/issues/22

#### Outcome

Protect public anonymous endpoints and keep failures recoverable.

#### Planning

- Ticket: RC-022
- Priority: P0
- Release: MVP
- Initial status: Backlog
- Dependencies: RC-020, RC-021
- Source of truth: docs/PRD-ReelClue.md on documentation PR, then main after approval

#### Scope

- Implement distributed atomic DB rate buckets, configurable browser/IP hash limits and bounded cleanup.
- Apply origin checks, payload limits, request IDs, no-store headers, redacted logs, safe health response and operational purge.

#### Acceptance criteria

- [ ] 429/503 preserve action state; Retry-After correct; multiple instances share limits.
- [ ] No raw IP/token/guess/hidden answer in telemetry; forwarded IP trust assumption documented.
- [ ] Retention cleanup respects active FKs and configured 7/30-day policies.
- [ ] All private routes enforce ownership, no shared caching and no arbitrary image-fetch URLs.

#### Validation

Rate bucket race tests, CSRF/origin and body-limit tests; inspect logs/error JSON; isolated purge and provider-outage drill.

#### Review and merge gate

One ticket = one branch = one PR. Branch from latest main only after dependencies are merged. Include this issue in the PR, validation evidence and manual review steps. Stop in In Review and send the PR to Andre. No self-merge or auto-merge. Do not begin the next implementation ticket until Andre reviews and this PR is merged. Mark Done only after merge. For RC-001, this planning request authorizes document preparation only.

### [RC-023] Run integrated mobile accessibility and game regression QA

GitHub: https://github.com/andresanjaya/reelclue/issues/23

#### Outcome

Verify all MVP modes work together before launch preparation.

#### Planning

- Ticket: RC-023
- Priority: P0
- Release: MVP
- Initial status: Backlog
- Dependencies: RC-022
- Source of truth: docs/PRD-ReelClue.md on documentation PR, then main after approval

#### Scope

- Add/complete Playwright critical flows with fake-provider fixtures and isolated DB.
- Run phone/desktop/keyboard/WebKit checks, answer-leak inspection, catalog calibration and actual performance measurements; fix only discovered regressions.

#### Acceptance criteria

- [ ] All six selections complete valid sessions; mode rules and server scoring verified.
- [ ] Refresh, two-tab conflict, retry, skip, third miss, hint cap, expired session and unavailable storage recover.
- [ ] Document measured performance and remaining limitations; manual iOS keyboard check identified explicitly.
- [ ] Andre reviews 10 sampled movies per level; unapproved catalog is not labelled production ready.

#### Validation

CI lint/typecheck/unit/integration/E2E/build plus documented manual device and calibration report.

#### UI UX Pro Max consistency verification

- Review the approved design-system/reelclue/MASTER.md and any page overrides against all implemented pages and modes.
- Inspect drift in typography, spacing, token usage, states, icons and responsive behavior; use targeted skill searches only for actual unresolved UI issues.

##### Additional acceptance criteria

- [ ] Home, setup, every clue mode, results, stats and About follow the reviewed design system or a documented page override.
- [ ] Custom interactive controls pass keyboard/focus/touch checks; long titles/cast/tags reflow, contrast is measured, and reduced motion is respected.
- [ ] QA report distinguishes skill recommendations from actual automated/manual verification and identifies remaining limitations.

#### Review and merge gate

One ticket = one branch = one PR. Branch from latest main only after dependencies are merged. Include this issue in the PR, validation evidence and manual review steps. Stop in In Review and send the PR to Andre. No self-merge or auto-merge. Do not begin the next implementation ticket until Andre reviews and this PR is merged. Mark Done only after merge. For RC-001, this planning request authorizes document preparation only.

### [RC-024] Prepare deployment preview and release runbook

GitHub: https://github.com/andresanjaya/reelclue/issues/24

#### Outcome

Make the reviewed MVP ready for owner-controlled release.

#### Planning

- Ticket: RC-024
- Priority: P0
- Release: MVP
- Initial status: Backlog
- Dependencies: RC-023
- Source of truth: docs/PRD-ReelClue.md on documentation PR, then main after approval

#### Scope

- Document Vercel/Supabase setup, private environment mapping, migrations, catalog activation, purge operation and rollback.
- Prepare preview validation checklist, current quota checks and configuration validation; configure production only when separately authorized.

#### Acceptance criteria

- [ ] Fresh setup steps reproducible; no credentials in runbook; cost/quotas verified at implementation time.
- [ ] Preview validation covers every mode, ownership, transformed posters, attribution and mobile layout.
- [ ] Rollback restores app/catalog without destroying live sessions or leaking secrets.
- [ ] PR is ready for Andre review; production deploy and merge are not executed automatically.

#### Validation

Clean-environment rehearsal where access exists, preview smoke report and runbook review; explicitly list infrastructure blockers.

#### Review and merge gate

One ticket = one branch = one PR. Branch from latest main only after dependencies are merged. Include this issue in the PR, validation evidence and manual review steps. Stop in In Review and send the PR to Andre. No self-merge or auto-merge. Do not begin the next implementation ticket until Andre reviews and this PR is merged. Mark Done only after merge. For RC-001, this planning request authorizes document preparation only.

### [RC-025] Add Daily Challenge with stable daily puzzle

GitHub: https://github.com/andresanjaya/reelclue/issues/25

#### Outcome

Offer a repeatable daily reason to return after MVP.

#### Planning

- Ticket: RC-025
- Priority: P1
- Release: Future extension — do not start with MVP
- Initial status: Backlog
- Dependencies: RC-024
- Source of truth: docs/PRD-ReelClue.md on documentation PR, then main after approval

#### Scope

- Define one shared daily 10-round Mixed/Medium puzzle using UTC day and frozen versions; local display explains reset time.
- Add server-persisted daily assignment, owned per-player progress and one official completed attempt; other attempts stay practice.

#### Acceptance criteria

- [ ] Same date gets same film/mode order across browsers without leaking future answers.
- [ ] Reload and timezone boundaries do not reset attempts; catalog refresh does not mutate daily assignment.
- [ ] No leaderboard or rewards; expiry/reset rules documented and reviewed before implementation.

#### Validation

Fixed-clock date-boundary tests, concurrent daily creation and resumed-progress E2E.

#### Review and merge gate

One ticket = one branch = one PR. Branch from latest main only after dependencies are merged. Include this issue in the PR, validation evidence and manual review steps. Stop in In Review and send the PR to Andre. No self-merge or auto-merge. Do not begin the next implementation ticket until Andre reviews and this PR is merged. Mark Done only after merge. For RC-001, this planning request authorizes document preparation only.

### [RC-026] Add spoiler-free result sharing

GitHub: https://github.com/andresanjaya/reelclue/issues/26

#### Outcome

Let players share outcomes without revealing movie answers.

#### Planning

- Ticket: RC-026
- Priority: P1
- Release: Future extension — do not start with MVP
- Initial status: Backlog
- Dependencies: RC-024
- Source of truth: docs/PRD-ReelClue.md on documentation PR, then main after approval

#### Scope

- Create share text with mode, level, score and outcome grid; native Share API when supported, clipboard fallback.
- Share only generic game link in MVP; owned session URL must not become publicly readable.

#### Acceptance criteria

- [ ] Shared payload has no titles/posters/aliases/private IDs or ownership tokens.
- [ ] Cancelled/unsupported share and clipboard failure handled accessibly.
- [ ] Outcome grid includes readable text alternative and does not rely only on color.

#### Validation

Inspect exact share payload; mock cancellation/API absence/clipboard errors; phone manual check.

#### Review and merge gate

One ticket = one branch = one PR. Branch from latest main only after dependencies are merged. Include this issue in the PR, validation evidence and manual review steps. Stop in In Review and send the PR to Andre. No self-merge or auto-merge. Do not begin the next implementation ticket until Andre reviews and this PR is merged. Mark Done only after merge. For RC-001, this planning request authorizes document preparation only.

### [RC-027] Add installable PWA with honest offline state

GitHub: https://github.com/andresanjaya/reelclue/issues/27

#### Outcome

Allow home-screen installation while keeping online game rules clear.

#### Planning

- Ticket: RC-027
- Priority: P1
- Release: Future extension — do not start with MVP
- Initial status: Backlog
- Dependencies: RC-024
- Source of truth: docs/PRD-ReelClue.md on documentation PR, then main after approval

#### Scope

- Add manifest, original simple icons and safe app-shell caching strategy.
- Show explicit offline page/status; never cache private game APIs, guesses, sessions or clear answers in shared caches.

#### Acceptance criteria

- [ ] Install metadata valid; reload/update behavior predictable.
- [ ] Offline does not claim a submitted guess succeeded; reconnect resumes from server.
- [ ] Service worker cache excludes game/search/poster private routes and environment-dependent data.

#### Validation

Offline/reconnect/update E2E and cache inspection; device install manual verification.

#### Review and merge gate

One ticket = one branch = one PR. Branch from latest main only after dependencies are merged. Include this issue in the PR, validation evidence and manual review steps. Stop in In Review and send the PR to Andre. No self-merge or auto-merge. Do not begin the next implementation ticket until Andre reviews and this PR is merged. Mark Done only after merge. For RC-001, this planning request authorizes document preparation only.

### [RC-028] Research and add a calibrated Indonesian movie collection

GitHub: https://github.com/andresanjaya/reelclue/issues/28

#### Outcome

Make familiarity more relevant to Indonesian players after global MVP validation.

#### Planning

- Ticket: RC-028
- Priority: P1
- Release: Future extension — do not start with MVP
- Initial status: Backlog
- Dependencies: RC-024
- Source of truth: docs/PRD-ReelClue.md on documentation PR, then main after approval

#### Scope

- Measure candidate coverage and run an explicit collection-specific familiarity calibration with Andre.
- Propose versioned collection filters, aliases and tier rules; preserve existing global catalog/session behavior.

#### Acceptance criteria

- [ ] Report real counts and limitations before promising Easy/Medium/Hard coverage.
- [ ] No automatic lowering of global 500-vote floor; any collection-specific policy change requires explicit PRD review.
- [ ] Indonesian title aliases and hints reviewed with representative samples; no invented local audience numbers.
- [ ] Unavailable combinations remain clearly unavailable; existing game sessions unaffected.

#### Validation

Provider sample/coverage report, per-tier manual calibration and regression tests for collection isolation.

#### Review and merge gate

One ticket = one branch = one PR. Branch from latest main only after dependencies are merged. Include this issue in the PR, validation evidence and manual review steps. Stop in In Review and send the PR to Andre. No self-merge or auto-merge. Do not begin the next implementation ticket until Andre reviews and this PR is merged. Mark Done only after merge. For RC-001, this planning request authorizes document preparation only.

