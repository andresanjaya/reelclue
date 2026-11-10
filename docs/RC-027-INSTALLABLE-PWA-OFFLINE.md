# RC-027: Installable PWA with Honest Offline State

## Overview
RC-027 implements installable Progressive Web App (PWA) capabilities for ReelClue while upholding the core product constraint: **ReelClue is an online deduction game where clues, movie guesses, scoring, and fairness are strictly owned and verified by the server**.

Offline play is not part of ReelClue MVP or this ticket. The PWA installation provides home-screen launcher integration, an app-shell caching strategy, and an honest offline state that explicitly refuses to pretend offline guesses succeeded, resuming server-authoritative state upon reconnect.

---

## Architecture & Deliverables

### 1. Web App Manifest & Metadata (`src/app/manifest.ts` & `src/app/layout.tsx`)
- **Manifest (`src/app/manifest.ts`)**:
  - Automatically served at `/manifest.webmanifest` by Next.js App Router.
  - `name`: "ReelClue — Movie Guessing Playground"
  - `short_name`: "ReelClue"
  - `start_url`: "/"
  - `scope`: "/"
  - `display`: "standalone"
  - `background_color`: `#10131a` (Canvas dark token from Master design baseline)
  - `theme_color`: `#10131a`
  - `orientation`: "portrait"
  - `categories`: `["games", "entertainment"]`
  - Fully calibrated icons: standard 192x192, standard 512x512, maskable 512x512, and 180x180 Apple touch icon.
- **Viewport & Apple Web App Meta (`src/app/layout.tsx`)**:
  - `viewport`: `{ themeColor: "#10131a", width: "device-width", initialScale: 1, viewportFit: "cover" }`
  - `appleWebApp`: `{ capable: true, statusBarStyle: "black-translucent", title: "ReelClue" }`
  - Direct `icons` link declarations.

### 2. Original Simple Icons (`public/icons/` & `scripts/generate-pwa-icons.ts`)
- Original vector SVG assets depicting the ReelClue cinema reel and deduction motif.
- Generated via Sharp into crisp PNG assets:
  - `public/icons/icon-192.png`: 192x192 standard icon for mobile launchers.
  - `public/icons/icon-512.png`: 512x512 high-resolution splash & launcher icon.
  - `public/icons/icon-512-maskable.png`: 512x512 with safe-zone margin (inner 80% circle) ensuring no clipping on adaptive Android icon shapes.
  - `public/icons/apple-touch-icon.png`: 180x180 iOS home-screen icon.
- Reproducible generator script registered in `package.json` as `pnpm run pwa:icons`.

### 3. Safe App-Shell Service Worker (`public/sw.js`)
- **Cache Versioning**:
  - `APP_SHELL_CACHE`: `reelclue-v1-shell`
  - `STATIC_CACHE`: `reelclue-v1-static`
- **Pre-cached App Shell Assets**:
  - Pre-caches `/offline`, `/manifest.webmanifest`, and icon assets on `install`.
  - Cleans up stale versions on `activate` and immediately claims uncontrolled clients (`self.clients.claim()`).
- **Strict Cache Exclusions (Zero Shared Cache Leak)**:
  - Any non-GET request bypasses caching entirely.
  - All URLs matching the following patterns **MUST NEVER BE CACHED**:
    - `/api/games/*`: Active sessions, guesses, hints, skips, next, results, poster blur bytes.
    - `/api/movies/search*`: TMDB autocomplete suggestions.
    - `/api/daily*`: Daily challenge puzzle state and official play attempts.
    - `/api/player*`: Anonymous player identity cookie establishment.
    - `/api/health`: Health status.
    - `/play/[id]`: Active gameplay routes containing live round clues.
  - Excluded routes are passed directly to `fetch(event.request)`. If the user is offline, the network error surfaces cleanly to client error handling.
- **App-Shell Navigation Caching**:
  - Navigation requests (`request.mode === 'navigate'`) use Network-First.
  - If network fails, falls back to the pre-cached `/offline` page.
- **Static Asset Caching**:
  - `/_next/static/*` and `/icons/*` use Cache-First with background revalidation.

### 4. Explicit Offline Page (`src/app/offline/page.tsx`)
- Standalone prerendered fallback page rendered when navigating without connectivity.
- Explains honestly that ReelClue is an online deduction game where clues, movie guesses, and fairness are verified by the server.
- Features:
  - Prominent "Retry Connection" action button (`window.location.reload()`) with `RefreshCw` icon.
  - "Back to Home" navigation button.
  - Meets 44px min touch target on all interactive elements.
  - Fully styled with ReelClue semantic tokens (`#10131a`, `#1a2030`, `#f4c95d`, `#6b7892`).
  - Accessible polite status region (`role="status"`, `aria-live="polite"`).

### 5. Honest Offline & Reconnect Gameplay (`gameplay-shell.tsx`, `play-setup.tsx`, `daily-view.tsx`)
- **No False Guesses**:
  - When `navigator.onLine === false`, submitting a guess immediately blocks submission and dispatches `GUESS_ERROR` with `code: "NETWORK_OFFLINE"`:
    *"You appear to be offline. Reconnect to the internet to submit your guess."*
  - The client **never** updates scores, advances rounds, or pretends a guess was evaluated locally.
- **Authoritative Reconnect Resumption**:
  - `gameplay-shell.tsx` listens for the `window` `online` event.
  - When connection is restored, it triggers `resyncSession()`, which queries `/api/games/[id]` to fetch the true server state (current round, remaining attempts, hint stage, score).
  - The UI dispatches `STALE_RELOAD`, clearing any transient network/offline errors and displaying:
    *"Session state synced with server."*
- **Setup & Daily Guards**:
  - `PlaySetup` and `DailyView` inspect `navigator.onLine` and display helpful offline feedback before making failing API requests.

### 6. PWA Lifecycle & UI Components
- **`OfflineBanner` (`src/components/pwa/offline-banner.tsx`)**:
  - Dynamically displays an accessible status banner when connectivity drops.
  - Surfaces a transient "Connection restored. Resuming online play..." toast when returning online.
- **`ServiceWorkerRegistration` (`src/components/pwa/sw-registration.tsx`)**:
  - Registers `/sw.js` in production or when `NEXT_PUBLIC_ENABLE_PWA=true`.
  - Listens for `updatefound` and `statechange` to detect waiting workers.
  - Prompts the user with an "Update Available" notification offering "Update Now" (`SKIP_WAITING` + clean reload) or "Later".

---

## Acceptance Criteria Verification

| Acceptance Criterion | Status | Verification Evidence |
| :--- | :---: | :--- |
| **Install metadata valid; reload/update behavior predictable** | PASS | `tests/unit/pwa-manifest.test.ts` validates manifest structure, icons, and Apple metadata; `tests/unit/pwa-offline-ui.test.tsx` validates update prompts and offline page. |
| **Offline does not claim a submitted guess succeeded; reconnect resumes from server** | PASS | `tests/unit/pwa-gameplay-offline.test.tsx` validates guess blocking when offline with zero POST requests, and `online` event triggers `resyncSession` from `/api/games/[id]`. |
| **Service worker cache excludes game/search/poster private routes and environment-dependent data** | PASS | `public/sw.js` contains strict `isExcludedRoute` checking `/api/games`, `/api/movies`, `/api/daily`, `/api/player`, and `/play/[id]`. Validated by unit test. |
