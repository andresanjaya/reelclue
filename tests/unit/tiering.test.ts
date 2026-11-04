// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import {
  computePercentiles,
  assignTiers,
  validateOverrides,
  type CandidateForTiering,
  type OverrideEntry,
} from "../../src/lib/server/catalog/tiering.ts";

function makeCandidate(id: number, overrides: Partial<CandidateForTiering> = {}): CandidateForTiering {
  return {
    tmdb_id: id,
    title: `Movie ${id}`,
    release_year: 2010,
    vote_count: 6000,
    vote_average: 7.5,
    popularity: 50,
    revenue: 100_000_000,
    eligible_modes: ["poster", "title", "synopsis", "cast", "genre"],
    ...overrides,
  };
}

describe("percentile computation", () => {
  it("handles empty and single-item inputs per PRD", () => {
    expect(computePercentiles([])).toEqual([]);
    expect(computePercentiles([123])).toEqual([0.5]);
  });

  it("assigns 0 to lowest, 1 to highest, and preserves exact ranks on distinct values", () => {
    const values = [10, 20, 30, 40];
    const p = computePercentiles(values);
    expect(p[0]).toBe(0);
    expect(p[1]).toBeCloseTo(1 / 3, 5);
    expect(p[2]).toBeCloseTo(2 / 3, 5);
    expect(p[3]).toBe(1);
  });

  it("averages occupied ranks on ties", () => {
    // 10 (rank 1), 20 & 20 (ranks 2 and 3 -> avg 2.5), 40 (rank 4)
    // (2.5 - 1) / 3 = 1.5 / 3 = 0.5
    const p = computePercentiles([10, 20, 20, 40]);
    expect(p[0]).toBe(0);
    expect(p[1]).toBe(0.5);
    expect(p[2]).toBe(0.5);
    expect(p[3]).toBe(1);
  });

  it("assigns 0.5 to all elements when all are tied", () => {
    const p = computePercentiles([5, 5, 5, 5]);
    expect(p).toEqual([0.5, 0.5, 0.5, 0.5]);
  });
});

describe("familiarity scoring and revenue reweighting", () => {
  it("reweights score when revenue is missing/zero rather than penalizing candidate", () => {
    const c1 = makeCandidate(1, { vote_count: 5000, popularity: 40, revenue: null });
    const c2 = makeCandidate(2, { vote_count: 5000, popularity: 40, revenue: 0 });
    const c3 = makeCandidate(3, { vote_count: 5000, popularity: 40, revenue: 50_000_000 });

    const { candidates } = assignTiers([c1, c2, c3]);
    // c1 and c2 have unknown revenue; they share the same reweighted formula (0.8*vote + 0.2*pop)
    const score1 = candidates.find(c => c.tmdb_id === 1)!.familiarity_score;
    const score2 = candidates.find(c => c.tmdb_id === 2)!.familiarity_score;
    expect(score1).toBe(score2);
  });
});

describe("deterministic tier band assignment and gates", () => {
  it("splits 10 candidates into 3 Easy (top 30%), 4 Medium (next 40%), and 3 Hard (bottom 30%)", () => {
    // 10 candidates with strictly decreasing vote counts and valid gates
    const list: CandidateForTiering[] = [
      makeCandidate(1, { vote_count: 20000, popularity: 100 }),
      makeCandidate(2, { vote_count: 15000, popularity: 90 }),
      makeCandidate(3, { vote_count: 10000, popularity: 80 }),
      makeCandidate(4, { vote_count: 8000, popularity: 70 }),
      makeCandidate(5, { vote_count: 5000, popularity: 60 }),
      makeCandidate(6, { vote_count: 3000, popularity: 50 }),
      makeCandidate(7, { vote_count: 2000, popularity: 40 }),
      makeCandidate(8, { vote_count: 1200, vote_average: 7.5, popularity: 30 }),
      makeCandidate(9, { vote_count: 800, vote_average: 8.0, popularity: 20 }),
      makeCandidate(10, { vote_count: 600, vote_average: 7.1, popularity: 10 }),
    ];

    const { candidates, report } = assignTiers(list);
    expect(report.bands).toEqual({ easy: 3, medium: 4, hard: 3 });

    // Movies 1, 2, 3 in top 30% have vote_count >= 5000 -> Easy
    expect(candidates.find(c => c.tmdb_id === 1)!.tier).toBe("easy");
    expect(candidates.find(c => c.tmdb_id === 2)!.tier).toBe("easy");
    expect(candidates.find(c => c.tmdb_id === 3)!.tier).toBe("easy");

    // Movies 4, 5, 6, 7 in next 40% have vote_count >= 1500 -> Medium
    expect(candidates.find(c => c.tmdb_id === 4)!.tier).toBe("medium");
    expect(candidates.find(c => c.tmdb_id === 5)!.tier).toBe("medium");
    expect(candidates.find(c => c.tmdb_id === 6)!.tier).toBe("medium");
    expect(candidates.find(c => c.tmdb_id === 7)!.tier).toBe("medium");

    // Movies 8, 9, 10 in bottom 30% have 500-9999 votes and rating >= 7.0 -> Hard
    expect(candidates.find(c => c.tmdb_id === 8)!.tier).toBe("hard");
    expect(candidates.find(c => c.tmdb_id === 9)!.tier).toBe("hard");
    expect(candidates.find(c => c.tmdb_id === 10)!.tier).toBe("hard");
  });

  it("leaves candidates failing band gates unassigned without forcing into another tier", () => {
    const list: CandidateForTiering[] = [
      // In Easy band (top 30%), but vote_count < 5000:
      makeCandidate(1, { vote_count: 4000, popularity: 100 }),
      // In Medium band (next 40%), but vote_count < 1500:
      makeCandidate(2, { vote_count: 1200, popularity: 50 }),
      // In Hard band (bottom 30%), but rating < 7.0:
      makeCandidate(3, { vote_count: 600, vote_average: 6.2, popularity: 10 }),
    ];

    const { candidates, report } = assignTiers(list);
    const c1 = candidates.find(c => c.tmdb_id === 1)!;
    const c2 = candidates.find(c => c.tmdb_id === 2)!;
    const c3 = candidates.find(c => c.tmdb_id === 3)!;

    expect(c1.assigned_band).toBe("easy");
    expect(c1.tier).toBeNull();
    expect(c1.gate_failure).toBe("easy_votes_low");

    expect(c2.assigned_band).toBe("medium");
    expect(c2.tier).toBeNull();
    expect(c2.gate_failure).toBe("medium_votes_low");

    expect(c3.assigned_band).toBe("hard");
    expect(c3.tier).toBeNull();
    expect(c3.gate_failure).toBe("hard_rating_low");

    expect(report.gateFailures).toEqual({
      easy_votes_low: 1,
      medium_votes_low: 1,
      hard_rating_low: 1,
    });
    expect(report.approved).toBe(0);
    expect(report.unassigned).toBe(3);
  });

  it("breaks ties deterministically by vote_count descending then tmdb_id ascending", () => {
    // Both have identical weighted score
    const c1 = makeCandidate(10, { vote_count: 3000, popularity: 20 });
    const c2 = makeCandidate(5, { vote_count: 5000, popularity: 20 }); // higher vote count
    const c3 = makeCandidate(3, { vote_count: 3000, popularity: 20 }); // lower ID than 10

    const { candidates } = assignTiers([c1, c2, c3]);
    // c2 should be top band (Easy) because vote_count 5000 > 3000
    expect(candidates.find(c => c.tmdb_id === 5)!.assigned_band).toBe("easy");
    // c3 has same votes as c1, but lower ID (3 < 10), so c3 takes medium, c1 takes hard
    expect(candidates.find(c => c.tmdb_id === 3)!.assigned_band).toBe("medium");
    expect(candidates.find(c => c.tmdb_id === 10)!.assigned_band).toBe("hard");
  });
});

describe("curated overrides", () => {
  it("applies valid tier override and exclusion with required audit metadata", () => {
    const list = [
      makeCandidate(1, { vote_count: 2000, vote_average: 7.5, popularity: 10 }), // naturally Hard band (vote_count >= 1500 for Medium)
      makeCandidate(2, { vote_count: 8000, popularity: 90 }), // naturally Easy band
    ];
    const overrides: OverrideEntry[] = [
      {
        tmdb_id: 1,
        tier: "medium",
        reason: "Cult classic widely known to cinephiles",
        reviewer: "Andre",
        reviewed_at: "2026-11-04",
      },
      {
        tmdb_id: 2,
        tier: "exclude",
        reason: "Content flagged for review",
        reviewer: "Andre",
        reviewed_at: "2026-11-04",
      },
    ];

    const { candidates, report } = assignTiers(list, overrides);
    expect(candidates.find(c => c.tmdb_id === 1)!.tier).toBe("medium");
    expect(candidates.find(c => c.tmdb_id === 2)!.tier).toBeNull();
    expect(report.overridesApplied).toBe(2);
  });

  it("rejects duplicate override IDs loudly as a conflict", () => {
    const overrides: OverrideEntry[] = [
      { tmdb_id: 1, tier: "medium", reason: "First", reviewer: "Andre", reviewed_at: "2026-11-04" },
      { tmdb_id: 1, tier: "easy", reason: "Conflicting second", reviewer: "Andre", reviewed_at: "2026-11-04" },
    ];
    expect(() => validateOverrides({ version: "tiering-v1", overrides })).toThrow("Override conflict: duplicate tmdb_id 1.");
  });

  it("forbids Hard override from bypassing Hard rating or vote gates", () => {
    const list = [
      makeCandidate(1, { vote_count: 800, vote_average: 6.5, popularity: 10 }), // rating too low for Hard
    ];
    const overrides: OverrideEntry[] = [
      { tmdb_id: 1, tier: "hard", reason: "Try to force into Hard", reviewer: "Andre", reviewed_at: "2026-11-04" },
    ];
    expect(() => assignTiers(list, overrides)).toThrow(
      "Hard override for TMDB ID 1 violates Hard tier gates (rating >= 7.0 and votes 500-9999 required)."
    );
  });

  it("fails loudly when override references a non-existent or base-ineligible candidate", () => {
    const list = [makeCandidate(1)];
    const overrides: OverrideEntry[] = [
      { tmdb_id: 999, tier: "medium", reason: "Ghost movie", reviewer: "Andre", reviewed_at: "2026-11-04" },
    ];
    expect(() => assignTiers(list, overrides)).toThrow(
      "Override error: candidate 999 not in eligible candidate pool."
    );
  });
});

describe("calibration sampling and coverage reporting", () => {
  it("samples up to 10 deterministically spaced movies per tier", () => {
    // 40 movies: 30% = 12 movies in Hard band
    const list: CandidateForTiering[] = Array.from({ length: 40 }, (_, i) =>
      makeCandidate(i + 1, {
        vote_count: 600 + i * 50,
        vote_average: 7.5,
        popularity: 10 + i,
      })
    );
    const { report } = assignTiers(list);
    expect(report.calibrationSample.hard).toHaveLength(10);
    // Highest familiarity score first in sample
    const sample = report.calibrationSample.hard;
    expect(sample[0].familiarity_score).toBeGreaterThanOrEqual(sample[sample.length - 1].familiarity_score);
  });

  it("detects coverage shortages and lists specific shortage reasons", () => {
    const list = [makeCandidate(1, { vote_count: 6000 })];
    const { report } = assignTiers(list);
    expect(report.shortages).toContain("tier_easy_shortage:1<100");
    expect(report.shortages).toContain("tier_medium_shortage:0<100");
    expect(report.shortages).toContain("tier_hard_shortage:0<100");
  });
});
