# ReelClue — OpenCode handoff

## Before starting

1. Review and merge documentation PR RC-001 only when Andre approves it.
2. Clone https://github.com/andresanjaya/reelclue and use latest main after that merge. Before merge, review the documentation branch; do not start implementation.
3. Configure TMDB credentials privately in `.env.local` when live integration is needed. Never paste them into a prompt destined for git. Supabase configuration is prepared in RC-004. RC-002 can run CI with safe test configuration.
4. Use [UI UX Pro Max setup and workflow](UI-SKILL-SETUP.md) for UI work. RC-002 verifies the development CLI/OpenCode integration and Python helper; RC-003 generates the reviewed design system. Later UI tickets read design-system/reelclue/MASTER.md and any relevant page override.
5. Confirm the selected ticket is in Project #7 and map board columns to Backlog, In Progress, In Review, Done if available. Preserve existing user settings. Board placement is currently pending, not a prerequisite to reading the documented backlog.

## First implementation prompt — copy after RC-001 is merged

```text
You are implementing ReelClue, a mobile-first movie guessing web game.

Read AGENTS.md, docs/PRD-ReelClue.md and docs/BACKLOG.md completely. Fetch issue #2 ([RC-002] Bootstrap Next.js TypeScript and CI) and latest main. Verify RC-001 documentation is merged. If not, report the blocker and stop without implementation.

Work ONLY on RC-002, one ticket at a time. Create feat/rc-002-bootstrap from latest main. Implement its scope and acceptance criteria. Choose compatible supported stable packages, pin pnpm, and commit the lockfile. Complete RC-002 UI UX Pro Max setup using docs/UI-SKILL-SETUP.md and the current official ui-ux-pro-max-cli package; initialize OpenCode, verify Python/search helper and record actual versions/paths. Missing prerequisites must be reported honestly. Do not generate UI foundations yet: that belongs to RC-003. Do not implement gameplay, add accounts, or expand scope.

Protect all secrets. Use ignored .env.local and placeholder-only .env.example. Server-only secrets must never have NEXT_PUBLIC_ prefixes or appear in browser bundles, logs, issues or PRs.

Run configured lint, typecheck, relevant tests and build. Do not invent successful test results. Open ONE PR targeting main with Closes #2, what changed, validation evidence and manual review steps.

STOP and send the PR link to Andre for review. Never self-merge or enable auto-merge. Do not close the issue as Done or start RC-003 until Andre reviews and this PR is merged. If access or tooling is missing, report the exact blocker and preserve the work.
```

## Prompt for subsequent tickets

Use the same prompt with the requested ticket number, code and scope. Read its actual issue, check dependencies on latest main, keep WIP=1, and stop for Andre's review after each PR. Future/P1 tickets are not automatic next steps. For UI tickets, explicitly use ui-ux-pro-max, read the approved design-system/reelclue/MASTER.md and page overrides, preserve semantic tokens, run focused searches as needed, and include actual visual/interaction verification. RC-003 produces that baseline; backend-only tickets do not need design searches.

## Local commands after scaffold exists

```bash
pnpm install --frozen-lockfile
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

These are required script names for RC-002, not commands already runnable in the documentation-only repository. Integration/E2E/catalog commands arrive with their owning tickets. Do not add a local production credential to CI just to make a build pass.
