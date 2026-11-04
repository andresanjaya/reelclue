# ReelClue — Agent instructions

## Source of truth
Read docs/PRD-ReelClue.md, docs/BACKLOG.md and the requested current GitHub issue before editing. Andre is the product owner and final reviewer. The project is a mobile-first movie guessing playground, not a native app.

## Mandatory workflow
- Work on exactly one instructed implementation ticket at a time. Check dependencies are merged.
- Branch from latest main using feat/rc-NNN-name, fix/rc-NNN-name or docs/rc-NNN-name.
- Never implement on main. Never combine unrelated tickets in one PR.
- Implement only ticket scope and its acceptance criteria. Record blockers accurately.
- Add meaningful tests for rules, state, persistence and API boundaries as those features are built. Do not postpone all validation to RC-023.
- Run configured lint, typecheck, relevant tests and build. Report commands and results honestly.
- Open one PR with Closes #N, behavior changes, validation evidence and review steps. UI changes include phone/desktop screenshots.
- STOP after opening the reviewable PR. Send the URL to Andre. Do not self-merge, enable auto-merge, close the issue as Done, or start another implementation ticket.
- Fix requested changes on the same PR. Only an explicit Andre instruction authorizes merging. Passing CI is not approval.
- After an authorized merge, sync main and take the next instructed issue. P1 tickets require an explicit instruction.

## Product and technical constraints
- Next.js App Router + strict TypeScript, Tailwind, shadcn/ui, server-only Supabase/TMDB, pnpm lockfile.
- Five clue types plus Mixed; Easy/Medium/Hard are movie familiarity tiers. Hard is established hidden gems, not films without audience evidence.
- No accounts, payments, public leaderboard, timer, streaming or AI-invented movie facts in MVP.
- Server owns movie selection, answer matching, attempts, hints, transitions and score. DB transactions plus idempotency/revision checks prevent duplicate actions.
- Never serialize unrevealed answers, alias arrays, future round lists or original poster sources to browser, HTML/RSC, metadata or errors.
- Poster clue must use actual transformed image bytes; a clear bitmap with CSS blur is insufficient.
- All private routes verify browser-cookie ownership; browser never gets a Supabase secret key or TMDB token.
- Keep all real secrets in ignored .env.local or hosting secrets. .env.example contains placeholders only. Never paste credentials into issues, commits, logs, PRs or screenshots.
- Observe TMDB credits and terms; no public catalog import endpoint or unbounded scraping.
- Preserve mobile input/keyboard usability, 44px targets, visible focus, reduced motion and accessible feedback.

## Current state
Documentation and backlog planning only. RC-001 requires review/merge before RC-002 starts. Board placement must be verified separately; issue existence does not establish membership in GitHub Project #7. Do not claim branch protection or hosting setup is configured unless verified.
