import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  checkIndonesianCollectionAvailability,
  evaluateIndonesianUnderGlobalFloor,
  getIndonesianTitleAliases,
  INDONESIAN_CALIBRATED_SAMPLE,
  INDONESIAN_COLLECTION_VERSION,
  INDONESIAN_GLOBAL_FLOOR_MOVIES,
  INDONESIAN_TIERING_POLICY_PROPOSAL,
  INDONESIAN_TMDB_CANDIDATE_COUNTS,
} from "@/lib/server/catalog/indonesian-collection";
import { assignTiers } from "@/lib/server/catalog/tiering";

describe("RC-028: Indonesian Movie Collection Research & Calibration", () => {
  describe("Empirical Candidate Counts & Global Floor Analysis", () => {
    it("reports real TMDB candidate counts showing severe drop-off at higher vote floors", () => {
      const counts = INDONESIAN_TMDB_CANDIDATE_COUNTS.byVoteFloor;

      // Real measured empirical facts from TMDB (Nov 2026)
      expect(counts.gte500).toBe(4);
      expect(counts.gte200).toBe(12);
      expect(counts.gte100).toBe(17);
      expect(counts.gte50).toBe(34);
      expect(counts.gte20).toBe(101);
      expect(counts.gte10).toBe(246);

      // Total catalog size
      expect(INDONESIAN_TMDB_CANDIDATE_COUNTS.totalCatalogMovies).toBeGreaterThan(7000);
    });

    it("verifies that only 4 Indonesian films meet the global 500-vote floor", () => {
      expect(INDONESIAN_GLOBAL_FLOOR_MOVIES).toHaveLength(4);

      const titles = INDONESIAN_GLOBAL_FLOOR_MOVIES.map((m) => m.title);
      expect(titles).toContain("The Raid");
      expect(titles).toContain("The Raid 2");
      expect(titles).toContain("The Night Comes For Us");
      expect(titles).toContain("Headshot");
    });

    it("confirms global tiering rules produce total shortage and cannot support an Indonesian collection", () => {
      const evaluation = evaluateIndonesianUnderGlobalFloor();

      expect(evaluation.globalFloor).toBe(500);
      expect(evaluation.isViableUnderGlobalRules).toBe(false);

      // Under global rules:
      // Easy (>= 5000 votes): 0 films
      // Medium (>= 1500 votes): 2 films (The Raid, The Raid 2)
      // Hard (500-9999 votes & rating >= 7.0): 0 films (Night Comes for Us has 6.97, Headshot has 6.43)
      expect(evaluation.tiers.easy).toBe(0);
      expect(evaluation.tiers.medium).toBe(2);
      expect(evaluation.tiers.hard).toBe(0);

      expect(evaluation.shortages.length).toBe(3);
      expect(evaluation.shortages[0]).toContain("tier_easy_shortage");
      expect(evaluation.shortages[1]).toContain("tier_medium_shortage");
      expect(evaluation.shortages[2]).toContain("tier_hard_shortage");
    });

    it("ensures the global 500-vote floor is strictly preserved and not lowered in standard catalog tiering", () => {
      // Test candidate pool with a 499-vote movie
      const candidatePool = [
        {
          tmdb_id: 999991,
          title: "Below Floor Film",
          release_year: 2020,
          vote_count: 499, // 1 vote below global 500-vote floor
          vote_average: 8.0,
          popularity: 10,
          revenue: null,
          eligible_modes: ["poster", "title", "synopsis", "cast", "genre"],
        },
      ];

      const { approved, report } = assignTiers(candidatePool);

      // Must be rejected by vote gates and not approved
      expect(approved).toHaveLength(0);
      expect(report.approved).toBe(0);
      expect(report.gateFailures.easy_votes_low).toBe(1);
    });
  });

  describe("Proposed Collection Policy & Calibration Sample", () => {
    it("proposes versioned collection policy with explicit vote floor", () => {
      expect(INDONESIAN_TIERING_POLICY_PROPOSAL.version).toBe(INDONESIAN_COLLECTION_VERSION);
      expect(INDONESIAN_TIERING_POLICY_PROPOSAL.collection_id).toBe("indonesia");
      expect(INDONESIAN_TIERING_POLICY_PROPOSAL.minimumVoteFloor).toBe(15);
      expect(INDONESIAN_TIERING_POLICY_PROPOSAL.tiers.easy).toBeDefined();
      expect(INDONESIAN_TIERING_POLICY_PROPOSAL.tiers.medium).toBeDefined();
      expect(INDONESIAN_TIERING_POLICY_PROPOSAL.tiers.hard).toBeDefined();
    });

    it("verifies calibrated representative sample integrity and valid metadata", () => {
      expect(INDONESIAN_CALIBRATED_SAMPLE.length).toBeGreaterThanOrEqual(15);

      for (const movie of INDONESIAN_CALIBRATED_SAMPLE) {
        expect(movie.tmdb_id).toBeGreaterThan(0);
        expect(movie.title.length).toBeGreaterThan(0);
        expect(movie.original_title.length).toBeGreaterThan(0);
        expect(movie.release_year).toBeGreaterThanOrEqual(1990);
        expect(movie.vote_count).toBeGreaterThanOrEqual(15);
        expect(movie.vote_average).toBeGreaterThan(0);
        expect(movie.directors.length).toBeGreaterThan(0);
        expect(movie.cast_members.length).toBeGreaterThanOrEqual(3);
        expect(movie.genres.length).toBeGreaterThan(0);
        expect(movie.approved_aliases.length).toBeGreaterThanOrEqual(1);

        // Acceptance criterion: No invented local audience numbers in hints or rationales
        expect(movie.rationale).not.toMatch(/\d+\s*(?:juta|million)\s*(?:penonton|viewers|tickets)/i);
      }
    });

    it("resolves dual title aliases for Indonesian and English international releases", () => {
      // The Raid -> Serbuan Maut
      const raidAliases = getIndonesianTitleAliases(94329);
      expect(raidAliases).toContain("The Raid");
      expect(raidAliases).toContain("Serbuan Maut");

      // Satan's Slaves -> Pengabdi Setan
      const satansSlavesAliases = getIndonesianTitleAliases(467012);
      expect(satansSlavesAliases).toContain("Pengabdi Setan");
      expect(satansSlavesAliases).toContain("Satan's Slaves");

      // Laskar Pelangi -> The Rainbow Troops
      const laskarAliases = getIndonesianTitleAliases(22421);
      expect(laskarAliases).toContain("Laskar Pelangi");
      expect(laskarAliases).toContain("The Rainbow Troops");

      // Ada Apa dengan Cinta? -> What's Up with Cinta?
      const aadcAliases = getIndonesianTitleAliases(39060);
      expect(aadcAliases).toContain("Ada Apa dengan Cinta?");
      expect(aadcAliases).toContain("AADC");
      expect(aadcAliases).toContain("What's Up with Cinta?");

      // Non-existent ID returns empty array
      expect(getIndonesianTitleAliases(9999999)).toEqual([]);
    });
  });

  describe("Availability Gating & Shortage Handling", () => {
    it("reports unavailable combinations when candidate count is less than 10", () => {
      // Current calibrated sample has 7 easy movies (< 10)
      const easyCheck = checkIndonesianCollectionAvailability("poster", "easy");
      expect(easyCheck.isAvailable).toBe(false);
      expect(easyCheck.eligibleCount).toBe(7);
      expect(easyCheck.minimumRequired).toBe(10);
      expect(easyCheck.shortageReason).toContain("Catalog shortage");
      expect(easyCheck.shortageReason).toContain("7/10");
    });

    it("reports shortage for cast mode when cast requirements are not met", () => {
      const castCheck = checkIndonesianCollectionAvailability("cast", "hard");
      // All hard movies in sample have >=3 cast members, but total is 6 (< 10)
      expect(castCheck.isAvailable).toBe(false);
      expect(castCheck.minimumRequired).toBe(10);
      expect(castCheck.shortageReason).toContain("Catalog shortage");
    });
  });
});
