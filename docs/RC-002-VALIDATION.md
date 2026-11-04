# RC-002 — Bootstrap validation

Verified 4 November 2026. Bootstrap only; not a playable or deployed product.

## Scope and review dependency

Andre instructed RC-001 to move to In Review and RC-002 to continue before baseline merge. `feat/rc-002-bootstrap` starts at RC-001 commit `deed77a`; RC-002 must not merge before PR #29. No approval or merge inferred. This exception does not change future ticket gates. Four PRD review findings remain on PR #29 for owner review; none blocks this bootstrap's limited scope.

## Actual checks

| Check | Result |
| --- | --- |
| Node/npm/pnpm | 22.23.3 / 10.9.9 / 10.33.0 |
| Python | `py -3 --version` and `python --version`: 3.12.0 |
| `pnpm install --frozen-lockfile` | Pass in working checkout |
| Clean install | Pass in separate empty temporary checkout of app/config/test files using `pnpm install --frozen-lockfile --offline`; no existing node_modules, .next or env file |
| `pnpm lint` | Pass, zero warnings, including clean checkout |
| `pnpm typecheck` | Pass, including clean checkout |
| `pnpm test` | 7/7 pass, including clean checkout |
| `pnpm build` | Pass, including clean checkout with no credentials; production build ID generated |
| Env boundary | Missing provider credentials allowed; HTTP(S) app URL required if configured; unknown fields dropped; errors contain no submitted value |
| Client bundle scan | Zero matches for test-only TMDB/Supabase sentinels or credential variable names under `.next/static` after sentinel build |
| Ignore rules | `.env.local` and `.env.production` ignored; `.env.example` tracked; caches/build output ignored |
| Browser | Production server returned HTTP 200; headless installed Chrome via temporary Playwright tooling; no added browser-test runtime dependency |
| Responsive | 320×800, 360×800, 390×844, 768×1024, 1440×900: no horizontal overflow, 16px body, one labelled H1, English language and expected metadata |
| Keyboard/motion | Tab finds no fake interactive controls; reduced-motion mode has zero animations; no browser JS errors or external requests |
| Screenshots | Captured and visually reviewed [phone](evidence/rc-002/home-360.png) and [desktop](evidence/rc-002/home-1440.png) |
| UI skill | CLI 2.15.0 installed; local SKILL.md loaded successfully through OpenCode skill tool; scripts/data present; Python `search.py --help` passed |

Seven unit cases cover the rendered placeholder, missing-provider configuration and unknown-field stripping, valid HTTPS configuration, and four invalid app URL values without leaking input. `server-only` guards the actual process environment wrapper; the pure parser is testable without Next.js runtime.

## Skill evidence and recommendation fit

CLI `--dry-run` was rejected, so installation was previewed in a fresh temporary directory before project initialization. Installer added unrelated skill folders; only the newly generated extras were removed. Required integration, scripts, data/provenance and upstream MIT license retained. No existing agent rules overwritten.

First query `responsive static page --stack nextjs` returned Partial Prerendering first, which does not fit this all-static placeholder. Narrowed once to `metadata server components --stack nextjs`; top result was Rendering / Use Server Components by default, followed by static metadata API guidance. Both fit this page and were applied. No Partial Prerendering, client component, remote fonts, unrelated icon library, animation library or generated design system added. Semantic colors use PRD brief as temporary baseline; approved Master belongs to RC-003.

## Manual reproduction

1. Use Node 22.23.3 and pnpm 10.33.0. Run `pnpm install --frozen-lockfile` with no `.env.local`.
2. Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, then `pnpm build`.
3. Run `pnpm start`; open http://localhost:3000 at phone and desktop widths. Confirm readable placeholder, no horizontal scroll and no nonfunctional Play button.
4. Confirm installed skill with `py -3 .opencode/skills/ui-ux-pro-max/scripts/search.py --help` on Windows (`python3` on macOS/Linux); load `ui-ux-pro-max` in OpenCode.

## Limits

- CI configuration added; remote CI result must be checked on PR, not inferred from local passes.
- No DB/provider startup checks yet; RC-004/RC-005 add required private configuration with their integrations.
- No gameplay, design-system generation, shadcn primitives, catalog, deployment or OS prerequisite installation.
- Browser checks use desktop Chrome emulation, not physical Safari/iOS keyboard testing. Placeholder has no inputs, dialogs or focusable controls to validate; those checks belong with later features.
- ESLint 9 is deprecated but required by current Next.js plugin peer ranges. TypeScript 7 exceeds lint parser support. Compatibility rationale and upgrade trigger in README.
- App/document diff passes whitespace checks; bundled upstream `design_system.py` retains 46 trailing-whitespace lines unchanged rather than modifying third-party code.
