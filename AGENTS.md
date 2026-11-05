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

## Required UI design workflow
- Use UI UX Pro Max for all tasks that design, implement, review or refine ReelClue UI. Setup belongs to RC-002; follow docs/UI-SKILL-SETUP.md and read .opencode/skills/ui-ux-pro-max/SKILL.md after installation.
- In RC-003, create and review design-system/reelclue/MASTER.md, then map it into one Tailwind/shadcn semantic token system. Subsequent UI tickets read the approved Master and relevant page override.
- Use focused Next.js/shadcn/Tailwind guidance as appropriate, verify recommendation fit, and keep small fixes scoped. Backend-only tickets do not need visual searches.
- Preserve existing reviewed theme decisions and installed framework versions. No automatic --force regeneration, new styling system, unrelated UI libraries or product-rule changes.
- Every UI PR includes actual mobile/desktop and keyboard/focus/state validation; generated guidance alone is not proof of quality. The one-ticket review/merge gate remains mandatory.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
