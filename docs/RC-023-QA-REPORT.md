# RC-023 — Integrated Mobile Accessibility and Game Regression QA Report

Date: 8 November 2026  
Branch: `feat/rc-023-mobile-a11y-regression-qa`  
Issue: [#23](https://github.com/andresanjaya/reelclue/issues/23)  
Auditor / Reviewer: Andre Sanjaya  

---

## 1. Outcome & Executive Summary

RC-023 integrates and validates all MVP game modes, edge-case recoveries, security and anti-cheat constraints, mobile responsiveness, accessibility tokens, and catalog familiarity calibration prior to release preparation (RC-024).

All automated verification gates (lint, typecheck, unit tests, E2E regression, production build) pass with **0 errors and 0 warnings**.

---

## 2. Automated Validation Evidence

| Check | Command | Result | Duration | Details |
| :--- | :--- | :--- | :--- | :--- |
| **Lint** | `pnpm lint` | **PASS** | ~48s | ESLint 9 max-warnings=0, no violations |
| **Typecheck** | `pnpm typecheck` | **PASS** | ~41s | Next.js route typegen + tsc clean |
| **Unit Tests** | `pnpm test` | **PASS** | 35.6s | 27 test files, 264/264 tests passing |
| **Playwright E2E** | `pnpm exec playwright test` | **PASS** | ~7.2m | 105 passed, 4 skipped (remote DB), 0 failed across 3 targets |
| **Production Build** | `pnpm build` | **PASS** | 12.5s | Next.js 16.4.5 (Turbopack) production build |

### Playwright Device Targets Verified:
1. **Mobile Chromium**: Pixel 7 viewport (412x915, mobile user-agent, touch enabled)
2. **Desktop Chromium**: Desktop Chrome (1280x900 viewport)
3. **WebKit Mobile**: iPhone 14 viewport (390x844, mobile Safari engine, touch enabled)

---

## 3. Scope & Acceptance Criteria Verification

### [x] All Six Modes Complete Valid 10-Round Sessions (`tests/e2e/fixture-flows.spec.ts`)
- Verified across **Poster Blur**, **Missing Title**, **Synopsis**, **Director & Cast**, **Genre Detective**, and **Mixed** across all 3 levels (Easy, Medium, Hard).
- 54 simulated full 10-round game flows (18 combinations x 3 browsers) completed with exact score progression (Easy +100, Medium +150, Hard +200 minus hint and miss penalties).
- Mixed mode verified deterministic rotation across modes per round.

### [x] Recovery States & Idempotency (`tests/e2e/recovery.spec.ts`)
- **Refresh**: Session reloads at the exact same active round and hint stage without penalty or session corruption.
- **Two-Tab Conflict (409 Conflict)**: When another tab advances the revision, the stale tab receives `REVISION_MISMATCH` (409) and automatically resyncs state with the server.
- **Lost Response Retry**: Dispatched guess with lost response retries using the exact same `actionId` and payload; backend deduplication handles idempotency without double-charging attempts.
- **Session Expiration (410 Gone)**: Expired sessions show explicit "Session Expired" screen and direct to new game setup.
- **Unavailable Storage**: Browser environments with blocked/failing `localStorage` gracefully run game creation and round advances without crashing.
- **Third Miss Exhaustion**: 3 wrong attempts trigger terminal round reveal ("Attempts exhausted"), reveal answer title, and assign 0 points.
- **Hint Cap**: Requesting hints caps at stage 3 with button disabled ("No hints remaining").

### [x] Answer-Leak and Opaque Handle Inspection (`tests/e2e/leak-inspection.spec.ts`)
- Inspected all JSON network payloads and DOM HTML before round completion.
- Verified that active rounds **never** serialize or reveal:
  - Answer title / original title
  - Movie aliases
  - Future round sequences
  - Original TMDB image paths or IDs
- Search autocomplete returns opaque choice handles (`fictional-handle` / UUIDs) without exposing movie IDs or answer validation keys.

---

## 4. UI UX Pro Max & Accessibility Verification

Verification conducted against `design-system/reelclue/MASTER.md` (no page overrides needed):

| Metric | Target | Measured Result | Status |
| :--- | :--- | :--- | :--- |
| **Body Contrast** | $\ge 4.5:1$ | **18.7:1** (`--foreground` on `--background`) | **PASS** |
| **Muted Contrast** | $\ge 4.5:1$ | **8.2:1** (`--muted-foreground` on `--card`) | **PASS** |
| **Button Contrast** | $\ge 4.5:1$ | **10.5:1** (`--primary-foreground` on `--primary`) | **PASS** |
| **Control Border Contrast** | $\ge 3.0:1$ | **3.8:1** (`--input` on `--card`) | **PASS** |
| **Touch Targets** | $\ge 44 \times 44$ px | All interactive controls $\ge 44 \times 44$ px | **PASS** |
| **Reduced Motion** | Disables transitions | `transitionDuration: 0s` under `prefers-reduced-motion` | **PASS** |
| **Viewport Reflow** | No horizontal overflow | 320px, 360px, 390px, 768px, 1440px scrollWidth $\le$ viewport | **PASS** |
| **Keyboard Navigation** | Visible outline $\ge 2$ px | Focus ring 2px solid amber with logical Tab sequence | **PASS** |

### Distinction Between Skill Recommendations & Verification
- **Skill recommendation accepted**: UI UX Pro Max dark OLED palette, semantic token structure, 44px minimum touch targets, visible 2px amber focus outlines, and `prefers-reduced-motion` CSS compliance.
- **Skill recommendation rejected**: Marketing funnels, booking/trailer recommendations, claymorphism/pink palettes, and auto-generated Select primitives for autocomplete (WAI-ARIA combobox in document flow was implemented instead).

---

## 5. Catalog Familiarity Calibration Sample (For Andre's Review)

Generated via live TMDB provider calibration dry run (`pnpm catalog:sync --dry-run`):
- Total candidates evaluated: 721
- Base accepted: 719 (2 rejected for runtime)
- Approved catalog size: **702 movies** (Easy: 216, Medium: 286, Hard: 200)
- Shortages: **None** (Exceeds all tier $\ge 100$ and mode $\ge 30$ requirements)
- Status: `activation: "ready"`

> [!IMPORTANT]
> **Production Readiness Gate**: Per ticket criteria, an unapproved catalog is not labelled production ready until Andre reviews this sample.

### Sample: 10 Movies per Familiarity Level

#### Easy (Top Familiarity, Vote Count $\ge 5000$)
1. **Avengers: Infinity War** (2018) — 33,354 votes, 8.25 rating, Fam: 1.0000 (Modes: Poster, Title, Synopsis, Cast, Genre)
2. **Pulp Fiction** (1994) — 31,276 votes, 8.48 rating, Fam: 0.9680 (Modes: Poster, Title, Synopsis, Cast, Genre)
3. **Mad Max: Fury Road** (2015) — 24,921 votes, 7.64 rating, Fam: 0.9345 (Modes: Poster, Title, Synopsis, Cast, Genre)
4. **Thor** (2011) — 23,035 votes, 6.80 rating, Fam: 0.9011 (Modes: Poster, Cast, Genre)
5. **Despicable Me** (2010) — 16,549 votes, 7.26 rating, Fam: 0.8677 (Modes: Poster, Title, Synopsis, Cast, Genre)
6. **Alien** (1979) — 17,096 votes, 8.18 rating, Fam: 0.8343 (Modes: Poster, Title, Cast, Genre)
7. **Man of Steel** (2013) — 16,790 votes, 6.70 rating, Fam: 0.8008 (Modes: Poster, Title, Synopsis, Cast, Genre)
8. **Men in Black** (1997) — 15,409 votes, 7.23 rating, Fam: 0.7674 (Modes: Poster, Title, Cast, Genre)
9. **Ant-Man and the Wasp** (2018) — 14,673 votes, 6.89 rating, Fam: 0.7340 (Modes: Poster, Title, Synopsis, Cast, Genre)
10. **Her** (2013) — 15,816 votes, 7.83 rating, Fam: 0.7006 (Modes: Poster, Cast, Genre)

#### Medium (Mid-Range Familiarity, Vote Count $\ge 1500$)
1. **Dead Poets Society** (1989) — 13,151 votes, 8.30 rating, Fam: 0.6992 (Modes: Poster, Title, Synopsis, Cast, Genre)
2. **Die Hard** (1988) — 12,842 votes, 7.82 rating, Fam: 0.6560 (Modes: Poster, Title, Synopsis, Cast, Genre)
3. **Furious 7** (2015) — 11,621 votes, 7.21 rating, Fam: 0.6114 (Modes: Poster, Title, Cast, Genre)
4. **John Wick: Chapter 4** (2023) — 8,514 votes, 7.71 rating, Fam: 0.5669 (Modes: Poster, Title, Cast, Genre)
5. **Kick-Ass** (2010) — 12,776 votes, 7.13 rating, Fam: 0.5237 (Modes: Poster, Title, Cast, Genre)
6. **Halloween** (1978) — 6,517 votes, 7.56 rating, Fam: 0.4791 (Modes: Poster, Title, Cast, Genre)
7. **X-Men Origins: Wolverine** (2009) — 11,680 votes, 6.30 rating, Fam: 0.4345 (Modes: Poster, Title, Synopsis, Cast, Genre)
8. **City of God** (2002) — 8,605 votes, 8.43 rating, Fam: 0.3914 (Modes: Poster, Title, Synopsis, Cast, Genre)
9. **A Silent Voice: The Movie** (2016) — 4,765 votes, 8.40 rating, Fam: 0.3468 (Modes: Poster, Title, Cast, Genre)
10. **The Hunt** (2012) — 5,077 votes, 8.10 rating, Fam: 0.3008 (Modes: Poster, Title, Cast, Genre)

#### Hard (Hidden Gems: Votes 500–9999, Rating $\ge 7.0$)
1. **Love, Simon** (2018) — 6,375 votes, 7.96 rating, Fam: 0.2994 (Modes: Poster, Title, Synopsis, Cast, Genre)
2. **GOAT** (2026) — 1,156 votes, 8.03 rating, Fam: 0.2604 (Modes: Poster, Cast, Genre)
3. **Flipped** (2010) — 3,468 votes, 8.02 rating, Fam: 0.2242 (Modes: Poster, Title, Cast, Genre)
4. **Dial M for Murder** (1954) — 2,994 votes, 8.00 rating, Fam: 0.1908 (Modes: Poster, Title, Synopsis, Cast, Genre)
5. **Double Indemnity** (1944) — 2,135 votes, 8.09 rating, Fam: 0.1574 (Modes: Poster, Title, Synopsis, Cast, Genre)
6. **There's Still Tomorrow** (2023) — 1,582 votes, 8.06 rating, Fam: 0.1240 (Modes: Poster, Title, Synopsis, Cast, Genre)
7. **Raise the Red Lantern** (1991) — 884 votes, 8.03 rating, Fam: 0.0933 (Modes: Poster, Title, Cast, Genre)
8. **Better Days** (2019) — 594 votes, 8.10 rating, Fam: 0.0627 (Modes: Poster, Title, Synopsis, Cast, Genre)
9. **Selena Gomez: My Mind & Me** (2022) — 624 votes, 8.44 rating, Fam: 0.0320 (Modes: Poster, Title, Synopsis, Cast, Genre)
10. **BLACKPINK: Light Up the Sky** (2020) — 534 votes, 8.20 rating, Fam: 0.0000 (Modes: Poster, Title, Synopsis, Cast, Genre)

---

## 6. Remaining Limitations & Manual iOS Check

1. **Manual Physical iOS Safari Keyboard Verification**:
   - While WebKit mobile emulation (iPhone 14) verifies automated touch events, viewport resizing, focus rings, and input blurring, physical iOS Safari devices may exhibit onscreen virtual keyboard viewport resizing differences (`window.visualViewport`). Physical device verification should be included during pre-launch smoke testing (RC-024).
2. **Remote E2E Database Tests**:
   - 4 tests in `flows.spec.ts` are gated by `RUN_REMOTE_GAME_E2E` because they require an active Supabase test instance with migrated rate limits RPC. The 54 fixture flows verify full 10-round game mechanics offline without external flakiness.
3. **Production Catalog Staging**:
   - Catalog has not been written or activated in production DB pending Andre's approval of the 30 calibration titles above.

