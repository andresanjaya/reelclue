# ReelClue

**Every clue brings you closer.**

A mobile-first movie guessing playground powered by TMDB. Guess through Poster Blur, Missing Title, Synopsis, Director & Cast, Genre Detective, or a balanced Mixed session.

## Planning

- [Complete product requirements](docs/PRD-ReelClue.md)
- [28 ordered issues and acceptance criteria](docs/BACKLOG.md)
- [OpenCode starter prompt](docs/OPENCODE-START.md)
- [Agent workflow and review rules](AGENTS.md)
- [Required UI UX Pro Max installation and UI workflow](docs/UI-SKILL-SETUP.md)
- [GitHub Project](https://github.com/users/andresanjaya/projects/7/views/1)

Stack: Next.js 16.4.5 App Router, React 19.3.1, strict TypeScript 5.9.3, Tailwind 4.3.4, adapted shadcn/ui primitives, Lucide icons and Zod 4.6.7. Home is a development placeholder, not a playable game. RC-004 adds Supabase schema/server client foundations; TMDB and gameplay integrations belong to later tickets.

## Local development

Node.js **22.23.3** (`.node-version`), pnpm **10.33.0** (`packageManager`) and Python 3 for UI skill searches. Install the pinned pnpm with `npm install -g pnpm@10.33.0` if unavailable.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Open http://localhost:3000. Static pages need no `.env.local`, DB or real provider credentials. Optional `APP_BASE_URL` defaults to `http://localhost:3000`; invalid HTTP(S) URLs fail server initialization without echoing their values. DB configuration is validated lazily when privileged server client is used; other `.env.example` fields remain reserved for later integrations. Server modules use `server-only`; no secret is passed to a client component.

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm start
```

CI runs the first four checks plus `pnpm test:db` after a frozen-lockfile install, with only a localhost app URL and no GitHub/environment secrets. `test:db` requires running Docker and creates/discards a network-isolated PostgreSQL container; never uses `.env.local` or production. See [database migrations, retention command and validation](docs/RC-004-DATABASE.md). `typecheck` generates Next.js route types before `tsc`. Native build scripts are allowlisted in `pnpm-workspace.yaml`.

ESLint 9.39.5 is deprecated upstream but retained because current `eslint-plugin-react`/`eslint-plugin-import` peer ranges exclude ESLint 10. TypeScript 5.9.3 stays within `typescript-eslint`'s supported range; current TypeScript 7 does not. Upgrade when these plugins support newer majors, not by ignoring peer conflicts.

## Review gate

One ticket → one branch → one PR → Andre review → authorized merge. No self-merge or auto-merge. Dependencies must merge before work starts. RC-004 branches from merged RC-003; no permission to merge current work or begin RC-005.

## Credentials

Use ignored `.env.local` with the variable names in [.env.example](.env.example). Never commit real tokens/keys or use NEXT_PUBLIC_ for server secrets. Either the TMDB read access token or optional API Key is enough; prefer Bearer authorization.

## Data credits

Movie metadata and images will be sourced from [TMDB](https://www.themoviedb.org). The implementation must use its approved attribution assets and required non-endorsement notice before release.

## Current delivery state

All 28 repository issues were verified in Project #7 on 4 November 2026. RC-001–RC-003 are merged. RC-004 adds versioned schema, protected server client, isolated DB tests and explicit retention cleanup, pending review; no owner database was changed. `/ui-preview` remains fictional/local-only. No gameplay, TMDB calls, automatic merge, branch protection or deployment included. See [RC-004 database validation](docs/RC-004-DATABASE.md), [RC-003 screenshots](docs/RC-003-VALIDATION.md) and [RC-002 validation](docs/RC-002-VALIDATION.md).

## UI design guidance

Use [UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) for OpenCode UI work. CLI **2.15.0** installed and verified in RC-002 with Python **3.12.0** (`py -3` or `python` on Windows; `python3` on macOS/Linux). Required integration is committed under `.opencode/skills/ui-ux-pro-max/`, including scripts/data and upstream license; no runtime dependency. OpenCode successfully loaded skill ID `ui-ux-pro-max`. Read [Master delivered in merged RC-003](design-system/reelclue/MASTER.md), plus relevant page override before later UI work. Semantic tokens live in `src/app/globals.css`; `/ui-preview` demonstrates shared components without creating games. See [setup, query results and UI checklist](docs/UI-SKILL-SETUP.md).
