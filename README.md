# ReelClue

**Every clue brings you closer.**

A mobile-first movie guessing playground powered by TMDB. Guess through Poster Blur, Missing Title, Synopsis, Director & Cast, Genre Detective, or a balanced Mixed session.

## Planning

- [Complete product requirements](docs/PRD-ReelClue.md)
- [28 ordered issues and acceptance criteria](docs/BACKLOG.md)
- [OpenCode starter prompt](docs/OPENCODE-START.md)
- [Agent workflow and review rules](AGENTS.md)
- [GitHub Project](https://github.com/users/andresanjaya/projects/7/views/1)

Proposed stack: Next.js App Router, TypeScript, Tailwind, shadcn/ui, Supabase Postgres and server-only TMDB access. This branch contains documentation, not an implemented application.

## Review gate

One ticket → one branch → one PR → Andre review → authorized merge. No self-merge, no auto-merge, WIP=1. RC-001 documentation must be reviewed and merged before RC-002 implementation starts.

## Credentials

Use ignored `.env.local` with the variable names in [.env.example](.env.example). Never commit real tokens/keys or use NEXT_PUBLIC_ for server secrets. Either the TMDB read access token or optional API Key is enough; prefer Bearer authorization.

## Data credits

Movie metadata and images will be sourced from [TMDB](https://www.themoviedb.org). The implementation must use its approved attribution assets and required non-endorsement notice before release.

## Current delivery state

28 repository issues created; their membership in GitHub Project #7 is pending verification/addition. No feature implementation, automatic merge, branch-protection configuration or deployment is included in this documentation change.
