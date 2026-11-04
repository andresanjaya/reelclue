import "server-only";
import { z } from "zod";
import { modes } from "./sync.ts";

export const tieringRulesVersion = "tiering-v1";
export const tiers = ["easy", "medium", "hard"] as const;
export type Tier = typeof tiers[number];

export const overrideSchema = z.object({
  tmdb_id: z.number().int().positive(),
  tier: z.enum(["easy", "medium", "hard", "exclude"]),
  reason: z.string().trim().min(3),
  reviewer: z.string().trim().min(2),
  reviewed_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "ISO date YYYY-MM-DD required"),
});
export type OverrideEntry = z.infer<typeof overrideSchema>;

export const overridesConfigSchema = z.object({
  version: z.string().trim().min(1),
  overrides: z.array(overrideSchema),
});
export type OverridesConfig = z.infer<typeof overridesConfigSchema>;

export function computePercentiles(values: readonly number[]): number[] {
  const n = values.length;
  if (n === 0) return [];
  if (n === 1) return [0.5];
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => values[a] - values[b]);
  const result = new Array<number>(n);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && values[order[j + 1]] === values[order[i]]) j++;
    const avgRank = (i + 1 + (j + 1)) / 2;
    const percentile = (avgRank - 1) / (n - 1);
    for (let k = i; k <= j; k++) result[order[k]] = percentile;
    i = j + 1;
  }
  return result;
}

export type CandidateForTiering = {
  tmdb_id: number;
  title: string;
  release_year: number;
  vote_count: number;
  vote_average: number;
  popularity: number;
  revenue: number | null;
  eligible_modes: readonly string[];
};

export type TieredCandidate<T extends CandidateForTiering> = T & {
  familiarity_score: number;
  tier: Tier | null;
  assigned_band: Tier;
  gate_failure: string | null;
  override_applied: string | null;
};

export function validateOverrides(config: OverridesConfig) {
  const parsed = overridesConfigSchema.parse(config);
  const seen = new Set<number>();
  for (const entry of parsed.overrides) {
    if (seen.has(entry.tmdb_id)) throw new Error(`Override conflict: duplicate tmdb_id ${entry.tmdb_id}.`);
    seen.add(entry.tmdb_id);
  }
  return parsed.overrides;
}

export function assignTiers<T extends CandidateForTiering>(
  candidates: readonly T[],
  rawOverrides: readonly OverrideEntry[] = [],
) {
  const overrides = validateOverrides({ version: tieringRulesVersion, overrides: [...rawOverrides] });
  const n = candidates.length;
  if (n === 0) {
    return {
      candidates: [] as TieredCandidate<T>[],
      approved: [] as TieredCandidate<T>[],
      report: {
        tieringVersion: tieringRulesVersion,
        candidates: 0,
        approved: 0,
        unassigned: 0,
        bands: { easy: 0, medium: 0, hard: 0 },
        gateFailures: {} as Record<string, number>,
        tiers: { easy: 0, medium: 0, hard: 0 },
        coverage: {
          easy: Object.fromEntries(modes.map(m => [m, 0])),
          medium: Object.fromEntries(modes.map(m => [m, 0])),
          hard: Object.fromEntries(modes.map(m => [m, 0])),
        },
        shortages: ["easy tier shortage", "medium tier shortage", "hard tier shortage"],
        overridesApplied: 0,
        calibrationSample: { easy: [], medium: [], hard: [] },
      },
    };
  }

  const votePercentiles = computePercentiles(candidates.map(c => Math.log1p(c.vote_count)));
  const popPercentiles = computePercentiles(candidates.map(c => Math.log1p(c.popularity)));

  const posRevenueIndices = candidates.map((c, idx) => (c.revenue !== null && c.revenue > 0 ? idx : -1)).filter(idx => idx >= 0);
  const revPercentileMap = new Map<number, number>();
  if (posRevenueIndices.length > 0) {
    const revValues = posRevenueIndices.map(idx => Math.log1p(candidates[idx].revenue!));
    const revPercentiles = computePercentiles(revValues);
    posRevenueIndices.forEach((idx, i) => revPercentileMap.set(idx, revPercentiles[i]));
  }

  const weightedScores = candidates.map((_, i) => {
    const v = votePercentiles[i];
    const p = popPercentiles[i];
    const r = revPercentileMap.get(i);
    // Missing/zero revenue reweights to vote count rather than lowering familiarity.
    return r !== undefined ? 0.7 * v + 0.2 * p + 0.1 * r : 0.8 * v + 0.2 * p;
  });

  const familiarityScores = computePercentiles(weightedScores);

  // Deterministic total sort order: score desc, vote_count desc, tmdb_id asc.
  const sortedIndices = Array.from({ length: n }, (_, i) => i).sort((a, b) => {
    const scoreDiff = weightedScores[b] - weightedScores[a];
    if (Math.abs(scoreDiff) > 1e-9) return scoreDiff;
    const voteDiff = candidates[b].vote_count - candidates[a].vote_count;
    if (voteDiff !== 0) return voteDiff;
    return candidates[a].tmdb_id - candidates[b].tmdb_id;
  });

  const easyCutoff = Math.ceil(0.3 * n);
  const hardCutoff = n - Math.ceil(0.3 * n);

  const bands: Record<Tier, number> = { easy: 0, medium: 0, hard: 0 };
  const gateFailures: Record<string, number> = {};
  const recordFailure = (reason: string) => {
    gateFailures[reason] = (gateFailures[reason] ?? 0) + 1;
  };

  const tiered = new Array<TieredCandidate<T>>(n);
  const candidateIndexMap = new Map<number, number>();

  for (let k = 0; k < n; k++) {
    const idx = sortedIndices[k];
    const c = candidates[idx];
    candidateIndexMap.set(c.tmdb_id, idx);

    let band: Tier;
    if (k < easyCutoff) band = "easy";
    else if (k >= hardCutoff) band = "hard";
    else band = "medium";
    bands[band]++;

    let tier: Tier | null = null;
    let gateFailure: string | null = null;

    if (band === "easy") {
      if (c.vote_count >= 5000) tier = "easy";
      else {
        gateFailure = "easy_votes_low";
        recordFailure(gateFailure);
      }
    } else if (band === "medium") {
      if (c.vote_count >= 1500) tier = "medium";
      else {
        gateFailure = "medium_votes_low";
        recordFailure(gateFailure);
      }
    } else {
      if (c.vote_count < 500) gateFailure = "hard_votes_low";
      else if (c.vote_count > 9999) gateFailure = "hard_votes_high";
      else if (c.vote_average < 7.0) gateFailure = "hard_rating_low";
      else tier = "hard";
      if (gateFailure) recordFailure(gateFailure);
    }

    tiered[idx] = {
      ...c,
      familiarity_score: familiarityScores[idx],
      tier,
      assigned_band: band,
      gate_failure: gateFailure,
      override_applied: null,
    };
  }

  let overridesApplied = 0;
  for (const o of overrides) {
    const idx = candidateIndexMap.get(o.tmdb_id);
    if (idx === undefined) {
      throw new Error(`Override error: candidate ${o.tmdb_id} not in eligible candidate pool.`);
    }
    const c = tiered[idx];
    if (o.tier === "exclude") {
      c.tier = null;
      c.override_applied = `exclude:${o.reason}`;
      overridesApplied++;
      continue;
    }
    // Hard overrides cannot bypass Hard rating/vote gates.
    if (o.tier === "hard") {
      if (c.vote_count < 500 || c.vote_count > 9999 || c.vote_average < 7.0) {
        throw new Error(`Hard override for TMDB ID ${o.tmdb_id} violates Hard tier gates (rating >= 7.0 and votes 500-9999 required).`);
      }
    } else if (o.tier === "easy" && c.vote_count < 5000) {
      throw new Error(`Easy override for TMDB ID ${o.tmdb_id} violates Easy vote floor (>=5000 required).`);
    } else if (o.tier === "medium" && c.vote_count < 1500) {
      throw new Error(`Medium override for TMDB ID ${o.tmdb_id} violates Medium vote floor (>=1500 required).`);
    }

    c.tier = o.tier;
    c.override_applied = `tier:${o.tier}:${o.reason}`;
    overridesApplied++;
  }

  const approved = tiered.filter((c): c is TieredCandidate<T> & { tier: Tier } => c.tier !== null);
  const tierCounts: Record<Tier, number> = {
    easy: approved.filter(c => c.tier === "easy").length,
    medium: approved.filter(c => c.tier === "medium").length,
    hard: approved.filter(c => c.tier === "hard").length,
  };

  const coverage: Record<Tier, Record<string, number>> = {
    easy: Object.fromEntries(modes.map(m => [m, approved.filter(c => c.tier === "easy" && c.eligible_modes.includes(m)).length])),
    medium: Object.fromEntries(modes.map(m => [m, approved.filter(c => c.tier === "medium" && c.eligible_modes.includes(m)).length])),
    hard: Object.fromEntries(modes.map(m => [m, approved.filter(c => c.tier === "hard" && c.eligible_modes.includes(m)).length])),
  };

  const shortages: string[] = [];
  for (const t of tiers) {
    if (tierCounts[t] < 100) shortages.push(`tier_${t}_shortage:${tierCounts[t]}<100`);
    for (const m of modes) {
      if (coverage[t][m] < 30) shortages.push(`mode_${t}_${m}_shortage:${coverage[t][m]}<30`);
    }
  }

  // Sample 10 movies deterministically per tier for Andre's calibration review.
  const calibrationSample: Record<Tier, Array<ReturnType<typeof sampleDto>>> = {
    easy: sampleTier(approved.filter(c => c.tier === "easy")),
    medium: sampleTier(approved.filter(c => c.tier === "medium")),
    hard: sampleTier(approved.filter(c => c.tier === "hard")),
  };

  return {
    candidates: tiered,
    approved,
    report: {
      tieringVersion: tieringRulesVersion,
      candidates: n,
      approved: approved.length,
      unassigned: n - approved.length,
      bands,
      gateFailures,
      tiers: tierCounts,
      coverage,
      shortages,
      overridesApplied,
      calibrationSample,
    },
  };
}

function sampleDto(c: TieredCandidate<CandidateForTiering>) {
  return {
    tmdb_id: c.tmdb_id,
    title: c.title,
    release_year: c.release_year,
    vote_count: c.vote_count,
    vote_average: c.vote_average,
    popularity: c.popularity,
    revenue: c.revenue,
    familiarity_score: Number(c.familiarity_score.toFixed(4)),
    tier: c.tier!,
    eligible_modes: [...c.eligible_modes],
  };
}

function sampleTier(pool: Array<TieredCandidate<CandidateForTiering>>) {
  const sorted = [...pool].sort((a, b) => {
    const diff = b.familiarity_score - a.familiarity_score;
    if (Math.abs(diff) > 1e-9) return diff;
    return b.vote_count - a.vote_count;
  });
  const m = sorted.length;
  if (m === 0) return [];
  if (m <= 10) return sorted.map(sampleDto);
  const result: Array<ReturnType<typeof sampleDto>> = [];
  for (let i = 0; i < 10; i++) {
    const idx = Math.floor((i * (m - 1)) / 9);
    result.push(sampleDto(sorted[idx]));
  }
  return result;
}
