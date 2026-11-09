import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  createDeterministicRng,
  createDeterministicUuid,
  generateDailyRounds,
  getNextUtcMidnight,
  getSecondsUntilUtcMidnight,
  getUtcDateString,
} from "../../src/lib/server/daily/puzzle";
import type { PoolCandidate } from "../../src/lib/server/game/selection";

function makeCandidate(id: number, modes: string[] = ["poster", "title", "synopsis", "cast", "genre"], tier = "medium"): PoolCandidate {
  return {
    tmdb_id: id,
    tier,
    eligible_modes: modes,
  };
}

describe("Daily puzzle deterministic generation and UTC timing", () => {
  it("formats UTC date string as YYYY-MM-DD", () => {
    const fixed = new Date("2026-11-09T23:59:59.999Z");
    expect(getUtcDateString(fixed)).toBe("2026-11-09");

    const nextSec = new Date("2026-11-10T00:00:00.000Z");
    expect(getUtcDateString(nextSec)).toBe("2026-11-10");
  });

  it("calculates next UTC midnight accurately across date boundary", () => {
    const d1 = new Date("2026-11-09T14:30:00.000Z");
    const next1 = getNextUtcMidnight(d1);
    expect(next1.toISOString()).toBe("2026-11-10T00:00:00.000Z");

    const seconds = getSecondsUntilUtcMidnight(d1);
    expect(seconds).toBe(9.5 * 3600); // 9 hours 30 min = 34200 seconds

    const dEdge = new Date("2026-11-09T23:59:59.000Z");
    expect(getSecondsUntilUtcMidnight(dEdge)).toBe(1);
  });

  it("Mulberry32 PRNG produces identical sequence for identical seeds", () => {
    const rng1 = createDeterministicRng("daily:2026-11-09:cat-123");
    const rng2 = createDeterministicRng("daily:2026-11-09:cat-123");

    const seq1 = Array.from({ length: 20 }, () => rng1());
    const seq2 = Array.from({ length: 20 }, () => rng2());

    expect(seq1).toEqual(seq2);

    // Different seed produces different values
    const rng3 = createDeterministicRng("daily:2026-11-10:cat-123");
    const seq3 = Array.from({ length: 20 }, () => rng3());
    expect(seq1).not.toEqual(seq3);
  });

  it("createDeterministicUuid outputs valid RFC 4122 v4 UUID deterministically", () => {
    const uuid1 = createDeterministicUuid("seed-alpha");
    const uuid2 = createDeterministicUuid("seed-alpha");
    expect(uuid1).toBe(uuid2);

    // RFC 4122 v4 pattern
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    expect(uuid1).toMatch(uuidPattern);

    const uuid3 = createDeterministicUuid("seed-beta");
    expect(uuid3).toMatch(uuidPattern);
    expect(uuid1).not.toBe(uuid3);
  });

  it("generateDailyRounds produces identical 10 rounds and mode sequence for same date and catalog", () => {
    const candidates: PoolCandidate[] = [];
    for (let i = 1; i <= 30; i++) {
      candidates.push(makeCandidate(100 + i));
    }

    const rounds1 = generateDailyRounds(candidates, "2026-11-09", "cat-version-1");
    const rounds2 = generateDailyRounds(candidates, "2026-11-09", "cat-version-1");

    expect(rounds1).toHaveLength(10);
    expect(rounds1).toEqual(rounds2);

    // Verify exactly 2 rounds per mode across all 5 modes
    const allModes = ["poster", "title", "synopsis", "cast", "genre"];
    for (const m of allModes) {
      const modeRounds = rounds1.filter(r => r.mode === m);
      expect(modeRounds).toHaveLength(2);
    }

    // Verify all 10 movies are unique
    const movieIds = new Set(rounds1.map(r => r.movie_id));
    expect(movieIds.size).toBe(10);

    // Verify reveal_seeds are deterministic UUIDs
    for (const r of rounds1) {
      expect(r.reveal_seed).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    }

    // Next day produces different assignment
    const roundsNextDay = generateDailyRounds(candidates, "2026-11-10", "cat-version-1");
    expect(roundsNextDay).not.toEqual(rounds1);
  });

  it("throws CatalogShortageError when fewer than 10 medium candidates available", () => {
    const fewCandidates = [
      makeCandidate(1),
      makeCandidate(2),
      makeCandidate(3),
    ];

    expect(() => generateDailyRounds(fewCandidates, "2026-11-09", "cat-1")).toThrowError(
      /Not enough eligible movies/
    );
  });
});

