# RC-007 — familiarity tiers and curated overrides

4 November 2026. Branch `feat/rc-007-familiarity-tiers` from `22b1827` after RC-006 merged. Backend domain logic, migration, and CLI updates.

## Outcome

Make **Hard** mean established, well-regarded hidden gems instead of random obscure movies. Disjoint familiarity bands and vote/rating gates prevent poorly-known films or blockbuster movies from contaminating the wrong difficulties.

## Familiarity algorithm & percentiles

`src/lib/server/catalog/tiering.ts` implements the PRD Section 9 tiering engine:

1. **Percentile Ranking (`computePercentiles`)**:
   - Computes rank percentiles in `[0, 1]` across candidates.
   - For ties, uses average occupied rank: `(avgRank - 1) / (N - 1)`. All-tied sets evaluate to `0.5`.
   - Single-item input returns `[0.5]`.
   - Highest distinct value evaluates to `1.0`, lowest to `0.0`.
2. **Dimension Rankings**:
   - Evaluated across frozen candidate snapshot using `Math.log1p(vote_count)`, `Math.log1p(popularity)`, and positive `Math.log1p(revenue)`.
   - Only known positive revenue values (`revenue > 0`) enter the revenue percentile pool.
3. **Revenue Reweighting**:
   - Unknown revenue (`null`, `0`, or `<= 0`) reweights the 10% revenue weight to vote count:
     `score = 0.8 * votePercentile + 0.2 * popularityPercentile`.
   - Known positive revenue uses:
     `score = 0.7 * votePercentile + 0.2 * popularityPercentile + 0.1 * revenuePercentile`.
   - Missing revenue never lowers familiarity.
4. **Deterministic Total Order**:
   - Broken by `weightedScore desc`, then `vote_count desc`, then `tmdb_id asc`.
5. **Deterministic Band Partitioning**:
   - For $N$ candidates sorted by familiarity:
     - **Easy band**: Top 30% (`k < ceil(0.3 * N)`).
     - **Hard band**: Bottom 30% (`k >= N - ceil(0.3 * N)`).
     - **Medium band**: Next 40% (remaining indices in between).
6. **Disjoint Tier Gates**:
   - **Easy**: `vote_count >= 5000` (Broadly familiar).
   - **Medium**: `vote_count >= 1500` (Recognizable to regular viewers).
   - **Hard**: `vote_count between 500 and 9999` AND `vote_average >= 7.0` (Established hidden gems).
   - Candidates failing the gate in their band remain **unassigned** (`tier: null`); they are never forced into another tier.
7. **Curated Overrides (`config/catalog-overrides.json`)**:
   - Versioned JSON (`tiering-v1`) with `tmdb_id`, `tier` (`easy` | `medium` | `hard` | `exclude`), `reason`, `reviewer`, `reviewed_at`.
   - Duplicate TMDB IDs fail loudly (`Override conflict: duplicate tmdb_id ...`).
   - Hard overrides cannot bypass Hard rating (>= 7.0) or vote bounds (500–9999).
   - Easy / Medium overrides must satisfy their respective vote floors (>=5000 / >=1500).
   - Unknown or base-ineligible candidate IDs fail loudly.

## Coverage targets and activation gate

- Target: at least **100 approved movies per tier** (`easy`, `medium`, `hard`).
- Target: at least **30 approved movies per mode per tier** (`poster`, `title`, `synopsis`, `cast`, `genre`).
- Any shortage is identified in `report.shortages` and sets `report.activation = "blocked_coverage"`.
- Shortages do not silently lower thresholds.
- Fixture sources remain `report.activation = "blocked_fixture"`.
- Database migration `202611040003_catalog_tiering.sql` updates `stage_catalog` to insert `tier`, `familiarity_score`, and `tiering_version`.
- `activate_catalog` verifies all coverage targets and tier gates under table locks before atomic activation.

## Andre's calibration review

The report generates a deterministic **calibration sample** of up to 10 movies per tier (`easy`, `medium`, `hard`) spanning from highest familiarity to lowest familiarity in that tier:
- `tmdb_id`, `title`, `release_year`, `vote_count`, `vote_average`, `popularity`, `revenue`, `familiarity_score`, `tier`, `eligible_modes`.

## CLI Usage

```bash
# Network-free dry run with fake fixture
pnpm catalog:sync --dry-run --fixture

# Dry run with real provider configuration
pnpm catalog:sync --dry-run

# Stage to Supabase DB and activate if coverage passes (fixture forbidden)
pnpm catalog:sync --apply
```

## Validation Evidence

- `pnpm lint`: 0 errors, 0 warnings.
- `pnpm typecheck`: route types and typescript cleanly pass.
- `pnpm test`: 6 test files, 87 unit tests pass (percentiles, ties, 0.5 single item, missing revenue reweighting, band cutoffs, gates, override conflicts and gate enforcement, calibration sampling, shortages).
- `pnpm test:db`: isolated PostgreSQL 17 container verified all 3 migrations, staging rollback, activation gates, and browser role denial.
- `pnpm build`: Next.js 16.4.5 production build clean.
