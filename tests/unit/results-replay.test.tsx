import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  serializeGameResults,
  serializeTerminalReveal,
  type DbRound,
  type DbSession,
  type GameResultsDto,
} from "../../src/lib/server/game/dto";
import type { MovieDetails } from "../../src/lib/server/game/clues";
import { ResultsIncompleteView, ResultsView } from "../../src/features/game/results-view";
import { PlaySetup } from "../../src/features/game/play-setup";

vi.mock("server-only", () => ({}));

// Navigation mock
const mockPush = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams,
}));

function makeMockMovie(id: number, overrides: Partial<MovieDetails> = {}): MovieDetails {
  return {
    tmdb_id: id,
    title: `Movie ${id}`,
    original_title: `Original Movie ${id}`,
    release_year: 2010 + (id % 10),
    original_language: "en",
    genres: ["Drama", "Action"],
    sanitized_synopsis: `Synopsis for movie ${id}`,
    directors: [{ id: 100 + id, name: `Director ${id}` }],
    cast_members: [
      { id: 200 + id, name: `Actor A ${id}` },
      { id: 300 + id, name: `Actor B ${id}` },
    ],
    poster_path: `/poster-${id}.jpg`,
    ...overrides,
  };
}

function makeMockRound(ordinal: number, overrides: Partial<DbRound> = {}): DbRound {
  return {
    id: `round-id-${ordinal}`,
    session_id: "test-session-id",
    ordinal,
    movie_id: 1000 + ordinal,
    mode: "synopsis",
    hint_stage: 1,
    wrong_attempts: 1,
    state: "correct",
    score: 80,
    reveal_seed: `seed-${ordinal}`,
    ...overrides,
  };
}

describe("Results DTO serialization & calculations", () => {
  it("derives max score, accuracy, totals from server records without client trust", () => {
    const session: DbSession = {
      id: "session-123",
      player_id: "player-1",
      mode: "mixed",
      level: "medium",
      state: "completed",
      current_round: 10,
      score: 650,
      revision: 12,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 86400000).toISOString(),
      completed_at: new Date().toISOString(),
    };

    // 7 correct, 2 exhausted, 1 skipped
    const rounds: DbRound[] = Array.from({ length: 10 }, (_, i) => {
      const ord = i + 1;
      if (ord <= 7) {
        return makeMockRound(ord, { state: "correct", score: 80, hint_stage: 1, wrong_attempts: 1 });
      } else if (ord <= 9) {
        return makeMockRound(ord, { state: "exhausted", score: 0, hint_stage: 3, wrong_attempts: 3 });
      } else {
        return makeMockRound(ord, { state: "skipped", score: 0, hint_stage: 0, wrong_attempts: 0 });
      }
    });

    const roundPairs = rounds.map(r => ({
      round: r,
      movie: makeMockMovie(r.movie_id),
    }));

    const results = serializeGameResults(session, roundPairs);

    // Medium max score = 1500
    expect(results.max_score).toBe(1500);
    // Score matches server session exactly (650)
    expect(results.score).toBe(650);
    // 7 of 10 correct = 70% accuracy
    expect(results.accuracy).toBe(70);
    expect(results.correct_count).toBe(7);
    expect(results.total_rounds).toBe(10);
    // Hints: 7*1 + 2*3 + 1*0 = 13
    expect(results.total_hints_used).toBe(13);
    // Wrong guesses: 7*1 + 2*3 + 1*0 = 13
    expect(results.total_wrong_attempts).toBe(13);
    expect(results.rounds).toHaveLength(10);
  });

  it("handles missing optional metadata with clean fallbacks", () => {
    const round = makeMockRound(1);
    const bareMovie: MovieDetails = {
      tmdb_id: 999,
      title: "",
      original_title: "",
      release_year: 0,
      original_language: "en",
      genres: [] as string[],
      sanitized_synopsis: "",
      directors: [] as Array<{ id: number; name: string }>,
      cast_members: [] as Array<{ id: number; name: string }>,
      poster_path: null,
    };

    const reveal = serializeTerminalReveal(round, bareMovie);

    expect(reveal.title).toBe("Unknown Title");
    expect(reveal.poster_path).toBeNull();
    expect(reveal.synopsis).toBeNull();
    expect(reveal.genres).toEqual([]);
    expect(reveal.directors).toEqual([]);
    expect(reveal.cast).toEqual([]);
  });
});

describe("ResultsView component", () => {
  const sampleResults: GameResultsDto = {
    id: "test-session-id",
    mode: "mixed",
    level: "easy",
    state: "completed",
    score: 850,
    max_score: 1000,
    accuracy: 90,
    correct_count: 9,
    total_rounds: 10,
    total_hints_used: 4,
    total_wrong_attempts: 3,
    completed_at: "2026-11-05T10:00:00.000Z",
    rounds: [
      {
        ordinal: 1,
        mode: "synopsis",
        reveal: {
          tmdb_id: 101,
          title: "Good Will Hunting",
          original_title: "Good Will Hunting",
          release_year: 1997,
          genres: ["Drama"],
          directors: ["Gus Van Sant"],
          cast: ["Robin Williams", "Matt Damon"],
          synopsis: "A brilliant janitor solves math problems.",
          poster_path: "/good-will.jpg",
          outcome: "correct",
          score: 100,
          hints_used: 0,
          wrong_attempts: 0,
        },
      },
      {
        ordinal: 2,
        mode: "poster",
        reveal: {
          tmdb_id: 102,
          title: "Mystery Film",
          original_title: "Original Mystery Film",
          release_year: 0,
          genres: [],
          directors: [],
          cast: [],
          synopsis: null,
          poster_path: null, // missing poster test
          outcome: "exhausted",
          score: 0,
          hints_used: 3,
          wrong_attempts: 3,
        },
      },
    ],
  };

  it("renders final score, accuracy, summary stats, and round outcomes", () => {
    render(<ResultsView results={sampleResults} />);

    expect(screen.getByText("Session Results")).toBeInTheDocument();
    expect(screen.getByText("850")).toBeInTheDocument();
    expect(screen.getByText("out of 1000")).toBeInTheDocument();
    expect(screen.getByText("90%")).toBeInTheDocument();
    expect(screen.getByText("9 of 10 correct")).toBeInTheDocument();

    // Round 1
    expect(screen.getByText(/Round 1 · Synopsis/)).toBeInTheDocument();
    expect(screen.getByText("Good Will Hunting")).toBeInTheDocument();
    expect(screen.getByText("+100 pts")).toBeInTheDocument();

    // Round 2 fallbacks
    expect(screen.getByText(/Round 2 · Poster Blur/)).toBeInTheDocument();
    expect(screen.getByText("Mystery Film")).toBeInTheDocument();
    expect(screen.getByText("No poster available")).toBeInTheDocument();
    expect(screen.getByText("Director unavailable")).toBeInTheDocument();
    expect(screen.getByText("Cast unavailable")).toBeInTheDocument();
    expect(screen.getByText(/Exhausted \(0 pts\)/)).toBeInTheDocument();
  });

  it("includes safe TMDB external links with rel=noopener noreferrer", () => {
    render(<ResultsView results={sampleResults} />);

    const tmdbLinks = screen.getAllByRole("link", { name: /View on TMDB/i });
    expect(tmdbLinks).toHaveLength(2);
    expect(tmdbLinks[0]).toHaveAttribute("href", "https://www.themoviedb.org/movie/101");
    expect(tmdbLinks[0]).toHaveAttribute("target", "_blank");
    expect(tmdbLinks[0]).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("Play Again link preserves mode and difficulty context for setup confirmation", () => {
    render(<ResultsView results={sampleResults} />);

    const playAgainLinks = screen.getAllByRole("link", { name: /Play Again/i });
    expect(playAgainLinks.length).toBeGreaterThanOrEqual(1);
    expect(playAgainLinks[0]).toHaveAttribute("href", "/play?mode=mixed&difficulty=easy");
  });

  it("renders ResultsIncompleteView when session is incomplete", () => {
    render(<ResultsIncompleteView sessionId="session-incomplete-1" />);

    expect(screen.getByText("Game In Progress")).toBeInTheDocument();
    const resumeLink = screen.getByRole("link", { name: /Resume Game/i });
    expect(resumeLink).toHaveAttribute("href", "/play/session-incomplete-1");
  });
});

describe("Replay context retention in PlaySetup", () => {
  it("pre-selects mode and difficulty from search params without auto-starting", () => {
    mockSearchParams = new URLSearchParams("mode=cast&difficulty=hard");

    render(<PlaySetup />);

    const castRadio = screen.getByRole("radio", { name: /Director & Cast/i });
    expect(castRadio).toBeChecked();

    const hardRadio = screen.getByRole("radio", { name: /Hard/i });
    expect(hardRadio).toBeChecked();

    // Start button must exist for confirmation; no automatic push
    const startButton = screen.getByRole("button", { name: /Start Game/i });
    expect(startButton).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("pre-selects mode and level when 'level' param name is used", () => {
    mockSearchParams = new URLSearchParams("mode=genre&level=medium");

    render(<PlaySetup />);

    const genreRadio = screen.getByRole("radio", { name: /Genre Detective/i });
    expect(genreRadio).toBeChecked();

    const mediumRadio = screen.getByRole("radio", { name: /Medium/i });
    expect(mediumRadio).toBeChecked();
  });
});
