import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  CatalogShortageError,
  selectGameRounds,
  solveMixedDistribution,
  type ClueMode,
  type PoolCandidate,
} from "../../src/lib/server/game/selection";

function makeCandidate(id: number, eligibleModes: ClueMode[], tier = "easy"): PoolCandidate {
  return {
    tmdb_id: id,
    tier,
    eligible_modes: eligibleModes,
  };
}

describe("Mixed session distribution: balanced allocation and overlapping pools", () => {
  it("allocates exactly 2 rounds per mode for 10 unique movies across 5 modes", () => {
    // 25 candidates across modes
    const candidates: PoolCandidate[] = [];
    let id = 100;
    const allModes: ClueMode[] = ["poster", "title", "synopsis", "cast", "genre"];
    for (const m of allModes) {
      for (let k = 0; k < 5; k++) {
        candidates.push(makeCandidate(id++, [m]));
      }
    }

    const assigned = solveMixedDistribution(candidates);
    expect(assigned).toHaveLength(10);

    const movieIds = new Set(assigned.map(a => a.movie_id));
    expect(movieIds.size).toBe(10);

    for (const m of allModes) {
      const modeCount = assigned.filter(a => a.mode === m).length;
      expect(modeCount).toBe(2);
    }
  });

  it("handles heavily overlapping eligibility pools where multiple movies share modes", () => {
    // 12 candidates with overlapping memberships
    const candidates: PoolCandidate[] = [
      makeCandidate(1, ["poster", "title"]),
      makeCandidate(2, ["poster", "synopsis"]),
      makeCandidate(3, ["poster", "cast"]),
      makeCandidate(4, ["title", "cast"]),
      makeCandidate(5, ["title", "genre"]),
      makeCandidate(6, ["synopsis", "genre"]),
      makeCandidate(7, ["synopsis", "title"]),
      makeCandidate(8, ["cast", "genre"]),
      makeCandidate(9, ["cast", "poster"]),
      makeCandidate(10, ["genre", "poster"]),
      makeCandidate(11, ["genre", "synopsis"]),
      makeCandidate(12, ["title", "poster"]),
    ];

    const assigned = solveMixedDistribution(candidates);
    expect(assigned).toHaveLength(10);

    const movieIds = new Set(assigned.map(a => a.movie_id));
    expect(movieIds.size).toBe(10);

    const allModes: ClueMode[] = ["poster", "title", "synopsis", "cast", "genre"];
    for (const m of allModes) {
      const count = assigned.filter(a => a.mode === m).length;
      expect(count).toBe(2);
    }

    // Verify each movie was assigned to an eligible mode
    const candidateMap = new Map(candidates.map(c => [c.tmdb_id, c]));
    for (const pair of assigned) {
      const cand = candidateMap.get(pair.movie_id)!;
      expect(cand.eligible_modes).toContain(pair.mode);
    }
  });

  it("prioritizes most constrained eligibility pools first", () => {
    // Poster has exactly 2 eligible candidates; other modes have 4+ candidates
    const candidates: PoolCandidate[] = [
      makeCandidate(1, ["poster", "title"]),
      makeCandidate(2, ["poster", "genre"]),
      ...Array.from({ length: 4 }, (_, i) => makeCandidate(10 + i, ["title", "synopsis"])),
      ...Array.from({ length: 4 }, (_, i) => makeCandidate(20 + i, ["synopsis", "cast"])),
      ...Array.from({ length: 4 }, (_, i) => makeCandidate(30 + i, ["cast", "genre"])),
      ...Array.from({ length: 4 }, (_, i) => makeCandidate(40 + i, ["genre", "title"])),
    ];

    const assigned = solveMixedDistribution(candidates);
    const posterAssigned = assigned.filter(a => a.mode === "poster");
    expect(posterAssigned).toHaveLength(2);
    const posterIds = new Set(posterAssigned.map(a => a.movie_id));
    expect(posterIds).toEqual(new Set([1, 2]));
  });
});

describe("Mixed session distribution: shortages, impossibility and bounded search", () => {
  it("throws CatalogShortageError when total candidates < 10", () => {
    const candidates = Array.from({ length: 9 }, (_, i) =>
      makeCandidate(i + 1, ["poster", "title", "synopsis", "cast", "genre"])
    );
    expect(() => solveMixedDistribution(candidates)).toThrow(CatalogShortageError);
  });

  it("throws CatalogShortageError immediately when any mode has fewer than 2 candidates", () => {
    const candidates: PoolCandidate[] = [
      makeCandidate(1, ["poster"]), // only 1 poster candidate
      ...Array.from({ length: 15 }, (_, i) => makeCandidate(i + 2, ["title", "synopsis", "cast", "genre"])),
    ];
    expect(() => solveMixedDistribution(candidates)).toThrow(CatalogShortageError);
  });

  it("aborts via bounded backtracking (max 100 attempts) on impossible matching without freezing server", () => {
    // 10 candidates total, but 3 modes compete for the same 2 candidates
    const candidates: PoolCandidate[] = [
      makeCandidate(1, ["poster", "cast"]),
      makeCandidate(2, ["poster", "cast"]),
      makeCandidate(3, ["title", "synopsis"]),
      makeCandidate(4, ["title", "synopsis"]),
      makeCandidate(5, ["title", "synopsis"]),
      makeCandidate(6, ["title", "synopsis"]),
      makeCandidate(7, ["genre"]),
      makeCandidate(8, ["genre"]),
      makeCandidate(9, ["genre"]),
      makeCandidate(10, ["genre"]),
    ];
    // Cast and Poster both require candidate 1 and 2, making a disjoint 10-movie partition impossible
    expect(() => solveMixedDistribution(candidates)).toThrow(CatalogShortageError);
  });
});

describe("Mixed session distribution: replay history and relaxation", () => {
  it("excludes recent movies when the preferred pool is sufficient", () => {
    const candidates: PoolCandidate[] = [];
    const allModes: ClueMode[] = ["poster", "title", "synopsis", "cast", "genre"];
    for (let i = 1; i <= 25; i++) {
      candidates.push(makeCandidate(i, allModes));
    }

    const recentMovieIds = [1, 2, 3, 4, 5];
    const assigned = solveMixedDistribution(candidates, recentMovieIds);
    const assignedIds = new Set(assigned.map(a => a.movie_id));

    // None of recent movies should be selected
    for (const recent of recentMovieIds) {
      expect(assignedIds.has(recent)).toBe(false);
    }
  });

  it("relaxes recent-history exclusion when necessary to satisfy full mixed distribution", () => {
    // Only 10 candidates exist in total. 3 are in recentMovieIds.
    // Excluding recent would leave only 7 candidates (< 10), so it must relax to satisfy 10 rounds.
    const allModes: ClueMode[] = ["poster", "title", "synopsis", "cast", "genre"];
    const candidates = Array.from({ length: 10 }, (_, i) => makeCandidate(i + 1, allModes));
    const recentMovieIds = [1, 2, 3];

    const assigned = solveMixedDistribution(candidates, recentMovieIds);
    expect(assigned).toHaveLength(10);
    const assignedIds = new Set(assigned.map(a => a.movie_id));
    expect(assignedIds.size).toBe(10);
  });
});

describe("Mixed session distribution: round generation and determinism", () => {
  it("selectGameRounds produces 10 ordered rounds with unique seeds and frozen structure", () => {
    const allModes: ClueMode[] = ["poster", "title", "synopsis", "cast", "genre"];
    const candidates = Array.from({ length: 15 }, (_, i) => makeCandidate(i + 1, allModes));

    const rounds = selectGameRounds(candidates, "mixed");
    expect(rounds).toHaveLength(10);

    for (let i = 0; i < 10; i++) {
      expect(rounds[i].ordinal).toBe(i + 1);
      expect(rounds[i].reveal_seed).toMatch(/^[0-9a-f-]{36}$/);
    }

    const seeds = new Set(rounds.map(r => r.reveal_seed));
    expect(seeds.size).toBe(10);

    for (const m of allModes) {
      expect(rounds.filter(r => r.mode === m)).toHaveLength(2);
    }
  });

  it("yields identical assignments when given a deterministic pseudo-random number generator", () => {
    const allModes: ClueMode[] = ["poster", "title", "synopsis", "cast", "genre"];
    const candidates = Array.from({ length: 20 }, (_, i) => makeCandidate(i + 1, allModes));

    // Simple deterministic PRNG (Linear Congruential Generator)
    const createPrng = (seed: number) => {
      let s = seed;
      return () => {
        s = (s * 1664525 + 1013904223) % 4294967296;
        return s / 4294967296;
      };
    };

    const run1 = solveMixedDistribution(candidates, [], createPrng(42));
    const run2 = solveMixedDistribution(candidates, [], createPrng(42));

    expect(run1).toEqual(run2);
  });
});
