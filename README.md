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

Bootstrap stack: Next.js 16.4.5 App Router, React 19.3.1, strict TypeScript 5.9.3, Tailwind 4.3.4 and Zod 4.6.7. Home is a development placeholder, not a playable game. shadcn/ui, Supabase and TMDB integration belong to later tickets.

## Local development

Node.js **22.23.3** (`.node-version`), pnpm **10.33.0** (`packageManager`) and Python 3 for UI skill searches. Install the pinned pnpm with `npm install -g pnpm@10.33.0` if unavailable.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Open http://localhost:3000. Bootstrap needs no `.env.local`, DB or real provider credentials. Optional `APP_BASE_URL` defaults to `http://localhost:3000`; invalid HTTP(S) URLs fail server initialization without echoing their values. Remaining `.env.example` fields are reserved for later integrations and are not validated or used yet. Server env wrapper uses `server-only`; no secret is passed to a client component.

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm start
```

CI runs the first four checks after a frozen-lockfile install, with only a localhost app URL and no GitHub/environment secrets. `typecheck` generates Next.js route types before `tsc`. Native build scripts are allowlisted in `pnpm-workspace.yaml`.

ESLint 9.39.5 is deprecated upstream but retained because current `eslint-plugin-react`/`eslint-plugin-import` peer ranges exclude ESLint 10. TypeScript 5.9.3 stays within `typescript-eslint`'s supported range; current TypeScript 7 does not. Upgrade when these plugins support newer majors, not by ignoring peer conflicts.

## Review gate

One ticket → one branch → one PR → Andre review → authorized merge. No self-merge or auto-merge. Normally dependencies must merge before work starts. Andre explicitly authorized RC-002 to proceed while RC-001 is In Review on 4 November 2026; this branch is stacked on RC-001, not permission to merge either PR or bypass future gates.

## Credentials

Use ignored `.env.local` with the variable names in [.env.example](.env.example). Never commit real tokens/keys or use NEXT_PUBLIC_ for server secrets. Either the TMDB read access token or optional API Key is enough; prefer Bearer authorization.

## Data credits

Movie metadata and images will be sourced from [TMDB](https://www.themoviedb.org). The implementation must use its approved attribution assets and required non-endorsement notice before release.

## Current delivery state

All 28 repository issues were verified in Project #7 on 4 November 2026. RC-001 is In Review; RC-002 adds bootstrap/CI and a noninteractive home placeholder only. No gameplay, DB/provider calls, automatic merge, branch protection or deployment is included. See [RC-002 validation](docs/RC-002-VALIDATION.md).

## UI design guidance

Use [UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) for OpenCode UI work. CLI **2.15.0** installed and verified in RC-002 with Python **3.12.0** (`py -3` or `python` on Windows; `python3` on macOS/Linux). Required integration is committed under `.opencode/skills/ui-ux-pro-max/`, including scripts/data and upstream license; no runtime dependency. OpenCode successfully loaded skill ID `ui-ux-pro-max` in the implementation session. RC-003 produces the reviewed design system; none generated here. See [setup and verification](docs/UI-SKILL-SETUP.md).
