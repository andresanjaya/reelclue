# RC-006 — bounded catalog preparation and staging

4 November 2026. Branch `feat/rc-006-catalog-import` from `b62b096` after RC-004/RC-005 merged. Backend only. No live provider calls, hosted DB writes, public import endpoint or schedule configured.

## Commands and review gate

```bash
pnpm catalog:sync --dry-run --fixture
pnpm catalog:sync --dry-run
```

First command uses explicitly fictional provider, needs no secret and never fetches artwork. Second requires private TMDB configuration and performs bounded real ingestion reads; do not run without owner-configured credentials. Both prepare rows and print aggregate report only; no database client or write in dry-run. No title/alias/payload is printed.

The following command writes a new **staging** version to the configured Supabase project. Verify private `.env.local` points to intended development/staging project and apply migrations first. It does not activate a catalog or modify the existing active version.

```bash
pnpm catalog:sync --apply
```

`--fixture --apply` is forbidden before provider or DB initialization. No auto-selected fake fallback. `--apply` and `--dry-run` must be explicit and mutually exclusive. Unknown/duplicate flags rejected. No public route or automatic recurring sync exists.

**Production activation remains blocked until RC-007 tiering/coverage integration**, as recorded during PRD review. Every new RC-006 row has null tier/familiarity score and every staged version has null `tiering_version`. CLI never calls activation. Report uses `tiers: pending_rc007`, `activation: blocked_tiering`; no false per-tier coverage. RC-007 must compute reviewed, versioned tiers and update CLI/report before release. `activate_catalog` already checks real provenance, nonempty tiering version, score/tier gates, ≥100 movies per tier and ≥30 per mode/tier under table locks, then retires old version and activates new version in one transaction. No threshold lowered to demonstrate success.

## Bounded preparation

`src/lib/server/catalog/sync.ts` accepts injected `MovieProvider`; four workers each await provider calls sequentially. Existing provider enforces four active attempts across instances and 8-second/two-retry boundaries. Fetch one configuration, then at most 17 pages each for vote-count, popularity and qualified rating sort slices. Deduplicate IDs; stop at 1,000 unique candidates. Enrich details/credits/aliases; image metadata only when primary poster absent. No automatic unbounded pagination or full-catalog scrape.

Worst-case logical provider calls: 1 configuration + 51 discovery + 4×1,000 enrichment = **4,052**, up to **12,156 attempts** under existing retry cap, plus at most **1,000 poster probes** (one fetch each, no retries). Importer aborts on transient provider/image failure rather than staging partial data; workers settle before returning failure. 404 movie detail is excluded; absent credits/aliases/image metadata returns empty optional data, not invented people/titles. No staging begins until all preparation succeeds.

Base exclusions: adult, video, non-Released, empty date, release newer than UTC build date minus 90 days, missing/<60 runtime, <500 votes, invalid/empty titles, no usable mode. Provider schemas reject malformed sources. Equality at 90 days/60 minutes/500 votes is accepted. PRD base gates never relax. Known duplicate IDs deduplicated; reviewed ban/override lists belong to RC-007 and remain required before activation.

People deduplicated by identity, preserving first billed cast order and co-directors; store first five cast names. HTML/entities cleaned, unsafe/unknown markup disables relevant text. Provider alternative titles are **not approved aliases**: imported `approved_aliases` stays empty pending human review/RC-007 integration. All alternatives participate conservatively in synopsis redaction so unreviewed alias cannot leak an obvious title.

Mode flags are independent:

- Poster: actual allowed-source bytes decode successfully; path alone insufficient.
- Missing Title: ≥5 letter/digit graphemes.
- Synopsis: title/alias-redacted text ≥100 characters, clipped to ≤600 on sentence/word boundary, director and genre present.
- Director & Cast: director and ≥3 distinct billed people.
- Genre: genre/director/cast/original language; base-valid year already known.

Synopsis normalization uses NFKD, combining-mark removal, case-fold approximation, ampersand expansion and Unicode token boundaries. Redacts complete normalized canonical/original/alternative titles, not every component word. Maps normalized spans back to original text, retains unrelated words. Short/common titles conservatively disable synopsis for review; recheck remaining title leaks after clipping. No AI facts, invented date/alias/cast or raw synopsis retained in staged rows. Full Unicode answer judging remains RC-009, not this redaction helper.

Poster probe uses official `https://image.tmdb.org/t/p/w300`, validated basename, redirect rejection, no-store, 8-second abort, streamed 5MiB cap and Sharp 20-million-pixel limit/full decode. Corrupt/missing/oversized posters only disable poster; network/5xx failures abort import. No bitmap is persisted to disk/git. `sharp@0.35.5` already existed transitively through Next.js; now explicit direct dependency for owned decode use, not another image stack. Actual transformed gameplay delivery remains later poster ticket.

Report contains source/rules/build date/cutoff, candidate/duplicate/accepted counts, base rejection reasons, per-mode disabled/coverage counts, pending tiers/activation gate and bounded API call counts. No movie facts/IDs/artwork/secrets printed. `source_revision` freezes base rules/date for sanitized clue revision. Runtime Zod validation stays at provider boundary, including injected providers.

## DB migration and atomicity

`202611040002_catalog_import.sql` adds catalog provenance (`legacy` for existing rows), nullable future tiering version and two invoker RPCs with explicit search paths. `stage_catalog` accepts real-source report plus 1–1,000 rows, applies base checks and inserts version/rows atomically; duplicate/invalid rows roll back entire stage. Old active catalog is untouched. Fixtures rejected both at CLI and RPC source gate. A privileged caller could deliberately falsify provenance: this is not protection against stolen service-role credentials.

`activate_catalog` locks catalog/movie tables to serialize competing activation and stop row edits during coverage checks. Missing tiering/source/coverage fails before status change. One active-version unique index remains final constraint. Old catalogs retired, never deleted by activation; existing retention continues preserving all referenced versions. `anon` and `authenticated` cannot execute either RPC; no browser policy/grant added. RLS on existing tables unchanged.

## Validation and review

- `pnpm test`: unit/component/provider/catalog tests; fake CLI dry-run, dedupe/1,000-ID bound, base gate matrix, missing metadata, conservative redaction, cast order, real pixel decode and corrupt/oversized poster rejection.
- `pnpm test:db`: fresh network-disconnected PostgreSQL applies both migrations; prepare real fake-provider output in child Node process, assert fixture staging denied, test valid simulated real-source staging, duplicate-row rollback, missing-tiering/coverage/fixture activation denial, atomic 300-row coverage-validated swap and browser RPC denial. Synthetic tier values exist only in rollback test transaction; **not RC-007 implementation**.
- Required lint, typecheck and production build remain unchanged. No UI modified; screenshots not applicable.

Review commands above using fixture first. Review migration locks/grants, CLI guard, bounded counts, sanitization and poster decode. Run all configured checks with Docker active. Do not run real `--apply` against production as review step. Hosted Supabase/PostgREST smoke, real TMDB catalog coverage/calibration, alias approval and provider terms review remain owner-controlled later work; none claimed complete here.
