// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

import {
  maskTitleByGrapheme,
  clipSynopsis,
  buildSafeClue,
  type MovieDetails,
} from "../../src/lib/server/game/clues.ts";
import {
  serializeActiveRound,
  serializeGameSession,
  type DbRound,
  type DbSession,
} from "../../src/lib/server/game/dto.ts";
import {
  CatalogShortageError,
  selectSingleModeMovies,
  solveMixedDistribution,
  selectGameRounds,
  type PoolCandidate,
} from "../../src/lib/server/game/selection.ts";
import {
  hashToken,
  hashPayload,
  validateOrigin,
  GameError,
} from "../../src/lib/server/game/session.ts";

const sampleMovie: MovieDetails = {
  tmdb_id: 101,
  title: "Inception: The Beginning",
  original_title: "Inception",
  release_year: 2010,
  original_language: "en",
  genres: ["Action", "Sci-Fi", "Thriller"],
  sanitized_synopsis: "A thief who steals corporate secrets through the use of dream-sharing technology is given the inverse task of planting an idea into the mind of a C.E.O.",
  directors: [{ id: 1, name: "Christopher Nolan" }],
  cast_members: [
    { id: 10, name: "Leonardo DiCaprio" },
    { id: 11, name: "Joseph Gordon-Levitt" },
    { id: 12, name: "Elliot Page" },
    { id: 13, name: "Tom Hardy" },
    { id: 14, name: "Ken Watanabe" },
  ],
  poster_path: "/inception.jpg",
};

describe("Missing Title grapheme masking", () => {
  const seed = "40000000-0000-0000-0000-000000000001";

  it("uses exact PRD fractions, nested positions, and stable seeded results after refresh", () => {
    for (const title of ["Spider-Man: No Way Home", "東京物語と映画", "Café: 你好世界", "The Fellowship of the Ring"]) {
      const chars = Array.from(new Intl.Segmenter("en", { granularity: "grapheme" }).segment(title), part => part.segment);
      const count = chars.filter(char => /[\p{L}\p{N}]/u.test(char)).length;
      let previous: string[] | undefined;
      for (const [stage, fraction] of [0.35, 0.5, 0.65, 0.8].entries()) {
        const masked = maskTitleByGrapheme(title, seed, stage);
        const parts = Array.from(new Intl.Segmenter("en", { granularity: "grapheme" }).segment(masked), part => part.segment);
        expect(maskTitleByGrapheme(title, seed, stage)).toBe(masked);
        expect(parts).toHaveLength(chars.length);
        expect(parts.filter((part, index) => /[\p{L}\p{N}]/u.test(chars[index]) && part !== "_")).toHaveLength(
          Math.min(count - 1, Math.max(1, Math.floor(count * fraction)))
        );
        chars.forEach((part, index) => {
          if (!/[\p{L}\p{N}]/u.test(part)) expect(parts[index]).toBe(part);
          if (previous?.[index] !== "_" && previous && /[\p{L}\p{N}]/u.test(part)) expect(parts[index]).toBe(previous[index]);
        });
        expect(masked).toContain("_");
        previous = parts;
      }
    }
  });

  it("rejects titles with fewer than five maskable graphemes even if called directly", () => {
    for (const title of ["Amél", "🎬: 東京", "🏳️‍🌈 1234"]) {
      expect(() => maskTitleByGrapheme(title, seed, 0)).toThrow("not eligible");
    }
  });

  it("masks letters while preserving spaces and punctuation", () => {
    const masked = maskTitleByGrapheme("Spider-Man: No Way Home", seed, 0);
    expect(masked).toMatch(/^[A-Za-z0-9_\-:\s]+$/);
    expect(masked).toContain("-");
    expect(masked).toContain(":");
    expect(masked).toContain(" ");
    expect(masked).toContain("_");
  });

  it("strictly nests revealed letters across stages 0 -> 1 -> 2 -> 3", () => {
    const t0 = maskTitleByGrapheme("The Lord of the Rings: The Fellowship of the Ring", seed, 0);
    const t1 = maskTitleByGrapheme("The Lord of the Rings: The Fellowship of the Ring", seed, 1);
    const t2 = maskTitleByGrapheme("The Lord of the Rings: The Fellowship of the Ring", seed, 2);
    const t3 = maskTitleByGrapheme("The Lord of the Rings: The Fellowship of the Ring", seed, 3);

    const getRevealedIndices = (masked: string) => {
      const indices: number[] = [];
      for (let i = 0; i < masked.length; i++) {
        if (masked[i] !== "_") indices.push(i);
      }
      return new Set(indices);
    };

    const s0 = getRevealedIndices(t0);
    const s1 = getRevealedIndices(t1);
    const s2 = getRevealedIndices(t2);
    const s3 = getRevealedIndices(t3);

    // Each subsequent stage is a strict superset of revealed character positions
    for (const idx of s0) expect(s1.has(idx)).toBe(true);
    for (const idx of s1) expect(s2.has(idx)).toBe(true);
    for (const idx of s2) expect(s3.has(idx)).toBe(true);

    // Number of revealed characters increases or stays equal
    expect(s1.size).toBeGreaterThanOrEqual(s0.size);
    expect(s2.size).toBeGreaterThanOrEqual(s1.size);
    expect(s3.size).toBeGreaterThanOrEqual(s2.size);

    // Never reveals 100% of the title even at stage 3
    expect(t3).toContain("_");
  });

  it("produces deterministic output for the same seed and different for different seeds", () => {
    const title = "Interstellar";
    const out1 = maskTitleByGrapheme(title, seed, 1);
    const out2 = maskTitleByGrapheme(title, seed, 1);
    const out3 = maskTitleByGrapheme(title, "50000000-0000-0000-0000-000000000002", 1);

    expect(out1).toBe(out2);
    expect(out1).not.toBe(out3);
  });
});

describe("Safe clue building and leak prevention", () => {
  const roundId = "round-uuid-1";
  const sessionId = "session-uuid-1";
  const seed = "seed-uuid-1";

  it("builds poster clue without leaking year, genre or title at stages 0-2", () => {
    const clue0 = buildSafeClue("poster", 0, sampleMovie, sessionId, roundId, seed);
    expect(clue0).toEqual({
      mode: "poster",
      posterUrl: `/api/games/${sessionId}/rounds/${roundId}/poster?stage=0`,
    });
    expect(JSON.stringify(clue0)).not.toContain("Inception");
    expect(JSON.stringify(clue0)).not.toContain("2010");

    const clue3 = buildSafeClue("poster", 3, sampleMovie, sessionId, roundId, seed);
    expect(clue3).toEqual({
      mode: "poster",
      posterUrl: `/api/games/${sessionId}/rounds/${roundId}/poster?stage=3`,
      releaseYear: 2010,
      primaryGenre: "Action",
    });
  });

  it("builds synopsis clue with progressive hints", () => {
    const clue0 = buildSafeClue("synopsis", 0, sampleMovie, sessionId, roundId, seed);
    expect(clue0.mode).toBe("synopsis");
    if (clue0.mode === "synopsis") {
      expect(clue0.synopsis).toBe(sampleMovie.sanitized_synopsis);
      expect(clue0.decade).toBeUndefined();
      expect(clue0.director).toBeUndefined();
    }

    const clue1 = buildSafeClue("synopsis", 1, sampleMovie, sessionId, roundId, seed);
    if (clue1.mode === "synopsis") expect(clue1.decade).toBe("2010s");

    const clue2 = buildSafeClue("synopsis", 2, sampleMovie, sessionId, roundId, seed);
    if (clue2.mode === "synopsis") expect(clue2.primaryGenre).toBe("Action");

    const clue3 = buildSafeClue("synopsis", 3, sampleMovie, sessionId, roundId, seed);
    if (clue3.mode === "synopsis") expect(clue3.director).toBe("Christopher Nolan");
  });

  it("builds cast and genre clues with progressive reveals", () => {
    const castClue0 = buildSafeClue("cast", 0, sampleMovie, sessionId, roundId, seed);
    if (castClue0.mode === "cast") {
      expect(castClue0.director).toBe("Christopher Nolan");
      expect(castClue0.cast).toBeUndefined();
    }

    const castClue1 = buildSafeClue("cast", 1, sampleMovie, sessionId, roundId, seed);
    if (castClue1.mode === "cast") {
      expect(castClue1.cast).toEqual(["Leonardo DiCaprio"]);
    }

    const castClue3 = buildSafeClue("cast", 3, sampleMovie, sessionId, roundId, seed);
    if (castClue3.mode === "cast") {
      expect(castClue3.cast).toHaveLength(3);
      expect(castClue3.releaseYear).toBe(2010);
    }
  });

  it("clips synopsis longer than 600 chars at sentence/word boundary", () => {
    const longText = "Sentence one. ".repeat(60); // 840 chars
    const clipped = clipSynopsis(longText, 600);
    expect(clipped.length).toBeLessThanOrEqual(600);
    expect(clipped.endsWith(".")).toBe(true);
  });
});

describe("Safe DTO serialization", () => {
  const round: DbRound = {
    id: "round-1",
    session_id: "session-1",
    ordinal: 1,
    movie_id: 101,
    mode: "title",
    hint_stage: 1,
    wrong_attempts: 1,
    state: "guessing",
    score: 0,
    reveal_seed: "seed-1",
  };

  const session: DbSession = {
    id: "session-1",
    player_id: "player-1",
    mode: "title",
    level: "easy",
    state: "active",
    current_round: 1,
    score: 0,
    revision: 2,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 86400000).toISOString(),
    completed_at: null,
  };

  it("never includes movie_id, tmdb_id, title or aliases in active guessing DTO", () => {
    const activeRoundDto = serializeActiveRound(round, sampleMovie, session.id);
    expect(activeRoundDto.reveal).toBeNull();
    const str = JSON.stringify(activeRoundDto);
    expect(str).not.toContain("101");
    expect(str).not.toContain("Inception: The Beginning");
    expect(str).not.toContain("approved_aliases");
  });

  it("serializes completed rounds and omits future rounds", () => {
    const sessionDto = serializeGameSession(session, round, sampleMovie, []);
    expect(sessionDto.completed_rounds).toEqual([]);
    expect(sessionDto.active_round.id).toBe("round-1");
  });

  it("serializes terminal reveal when round is skipped", () => {
    const skippedRound: DbRound = { ...round, state: "skipped" };
    const terminalDto = serializeActiveRound(skippedRound, sampleMovie, session.id);
    expect(terminalDto.reveal).not.toBeNull();
    expect(terminalDto.reveal?.title).toBe("Inception: The Beginning");
    expect(terminalDto.reveal?.outcome).toBe("skipped");
  });
});

describe("Movie selection and Mixed allocation", () => {
  const makeCandidate = (id: number, modes: string[]): PoolCandidate => ({
    tmdb_id: id,
    tier: "easy",
    eligible_modes: modes,
  });

  it("selects 10 distinct movies for single mode and throws shortage if < 10", () => {
    const candidates = Array.from({ length: 15 }, (_, i) => makeCandidate(i + 1, ["poster"]));
    const selected = selectSingleModeMovies(candidates, "poster");
    expect(selected).toHaveLength(10);
    expect(new Set(selected).size).toBe(10);

    const fewCandidates = Array.from({ length: 9 }, (_, i) => makeCandidate(i + 1, ["poster"]));
    expect(() => selectSingleModeMovies(fewCandidates, "poster")).toThrow(CatalogShortageError);
  });

  it("relaxes recent history exclusion if preferred pool has fewer than 10 movies", () => {
    const candidates = Array.from({ length: 12 }, (_, i) => makeCandidate(i + 1, ["title"]));
    const recent = [1, 2, 3, 4, 5]; // leaves 7 preferred (< 10)
    const selected = selectSingleModeMovies(candidates, "title", recent);
    expect(selected).toHaveLength(10);
  });

  it("allocates exactly 2 rounds per mode in Mixed mode (10 total unique movies)", () => {
    // 20 candidates with varying mode eligibility
    const candidates: PoolCandidate[] = [];
    let id = 1;
    for (const m of ["poster", "title", "synopsis", "cast", "genre"]) {
      for (let k = 0; k < 4; k++) {
        candidates.push(makeCandidate(id++, [m]));
      }
    }

    const mixed = solveMixedDistribution(candidates);
    expect(mixed).toHaveLength(10);
    const assignedModes = mixed.map(m => m.mode);
    for (const m of ["poster", "title", "synopsis", "cast", "genre"]) {
      expect(assignedModes.filter(x => x === m)).toHaveLength(2);
    }
    const movieIds = new Set(mixed.map(m => m.movie_id));
    expect(movieIds.size).toBe(10);
  });

  it("throws shortage error if Mixed cannot satisfy 2 per mode", () => {
    // Only 1 movie eligible for poster
    const candidates: PoolCandidate[] = [
      makeCandidate(1, ["poster"]),
      ...Array.from({ length: 20 }, (_, i) => makeCandidate(i + 2, ["title", "synopsis", "cast", "genre"])),
    ];
    expect(() => solveMixedDistribution(candidates)).toThrow(CatalogShortageError);
  });

  it("generates 10 complete game rounds with unique seeds", () => {
    const candidates = Array.from({ length: 20 }, (_, i) =>
      makeCandidate(i + 1, ["poster", "title", "synopsis", "cast", "genre"])
    );
    const rounds = selectGameRounds(candidates, "mixed");
    expect(rounds).toHaveLength(10);
    const seeds = new Set(rounds.map(r => r.reveal_seed));
    expect(seeds.size).toBe(10);
  });
});

describe("Token hashing and origin validation", () => {
  it("computes 64-character SHA-256 hash of tokens and payloads", () => {
    const hash = hashToken("sample-token-abc");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);

    const payloadHash = hashPayload({ mode: "poster", level: "easy" });
    expect(payloadHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("validates origin headers to prevent CSRF mutations", () => {
    // Matching origin and host: valid
    const validReq = new Request("https://example.com/api/games", {
      method: "POST",
      headers: {
        origin: "https://example.com",
        host: "example.com",
      },
    });
    expect(() => validateOrigin(validReq)).not.toThrow();

    // Mismatched origin and host: forbidden
    const invalidReq = new Request("https://example.com/api/games", {
      method: "POST",
      headers: {
        origin: "https://evil.com",
        host: "example.com",
      },
    });
    expect(() => validateOrigin(invalidReq)).toThrow(GameError);
  });
});
