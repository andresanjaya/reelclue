import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  buildSafeClue,
  getLanguageLabel,
  type MovieDetails,
} from "../../src/lib/server/game/clues";
import { serializeActiveRound, type DbRound } from "../../src/lib/server/game/dto";
import { ClueRenderer } from "../../src/features/game/clue-renderer";

const sampleMovie: MovieDetails = {
  tmdb_id: 129,
  title: "Spirited Away",
  original_title: "千と千尋の神隠し",
  release_year: 2001,
  original_language: "ja",
  genres: ["Animation", "Family", "Fantasy", "Adventure"],
  sanitized_synopsis: "A young girl wanders into a world ruled by gods, witches, and spirits.",
  directors: [{ id: 608, name: "Hayao Miyazaki" }],
  cast_members: [
    { id: 19586, name: "Rumi Hiiragi" },
    { id: 19587, name: "Miyu Irino" },
    { id: 19588, name: "Mari Natsuki" },
  ],
  poster_path: "/spirited.jpg",
};

describe("Genre Detective mode: eligibility and formatting", () => {
  it("rejects movies missing required metadata: genres, year, director, cast, or language", () => {
    expect(() =>
      buildSafeClue("genre", 0, { ...sampleMovie, genres: [] }, "s1", "r1", "seed")
    ).toThrow("not eligible for Genre Detective mode");

    expect(() =>
      buildSafeClue("genre", 0, { ...sampleMovie, directors: [] }, "s1", "r1", "seed")
    ).toThrow("not eligible for Genre Detective mode");

    expect(() =>
      buildSafeClue("genre", 0, { ...sampleMovie, cast_members: [] }, "s1", "r1", "seed")
    ).toThrow("not eligible for Genre Detective mode");

    expect(() =>
      buildSafeClue("genre", 0, { ...sampleMovie, original_language: "" }, "s1", "r1", "seed")
    ).toThrow("not eligible for Genre Detective mode");

    expect(() =>
      buildSafeClue("genre", 0, { ...sampleMovie, release_year: 0 }, "s1", "r1", "seed")
    ).toThrow("not eligible for Genre Detective mode");
  });

  it("formats readable language labels accurately", () => {
    expect(getLanguageLabel("en")).toBe("English");
    expect(getLanguageLabel("ja")).toBe("Japanese");
    expect(getLanguageLabel("fr")).toBe("French");
    expect(getLanguageLabel("cn")).toBe("Cantonese");
    expect(getLanguageLabel("xx")).toBe("XX");
  });

  it("limits genres to maximum 3 and computes release decade", () => {
    const clue = buildSafeClue("genre", 0, sampleMovie, "s1", "r1", "seed");
    expect(clue.mode).toBe("genre");
    if (clue.mode === "genre") {
      expect(clue.genres).toEqual(["Animation", "Family", "Fantasy"]);
      expect(clue.decade).toBe("2000s");
    }
  });

  it("handles co-directors for hint stage 2", () => {
    const coDirectedMovie: MovieDetails = {
      ...sampleMovie,
      directors: [
        { id: 1, name: "Joel Coen" },
        { id: 2, name: "Ethan Coen" },
      ],
    };

    const clue = buildSafeClue("genre", 2, coDirectedMovie, "s1", "r1", "seed");
    if (clue.mode === "genre") {
      expect(clue.director).toBe("Joel Coen, Ethan Coen");
      expect(clue.directors).toEqual(["Joel Coen", "Ethan Coen"]);
    }
  });
});

describe("Genre Detective mode: progressive reveals and security", () => {
  it("progressively reveals language at stage 1, director at stage 2, lead and year at stage 3", () => {
    const clue0 = buildSafeClue("genre", 0, sampleMovie, "s1", "r1", "seed");
    expect(clue0).toEqual({
      mode: "genre",
      genres: ["Animation", "Family", "Fantasy"],
      decade: "2000s",
    });

    const clue1 = buildSafeClue("genre", 1, sampleMovie, "s1", "r1", "seed");
    expect(clue1).toMatchObject({
      mode: "genre",
      genres: ["Animation", "Family", "Fantasy"],
      decade: "2000s",
      originalLanguage: "ja",
      originalLanguageLabel: "Japanese",
    });
    expect(clue1).not.toHaveProperty("director");
    expect(clue1).not.toHaveProperty("leadActor");
    expect(clue1).not.toHaveProperty("releaseYear");

    const clue2 = buildSafeClue("genre", 2, sampleMovie, "s1", "r1", "seed");
    expect(clue2).toMatchObject({
      mode: "genre",
      genres: ["Animation", "Family", "Fantasy"],
      decade: "2000s",
      originalLanguage: "ja",
      director: "Hayao Miyazaki",
    });
    expect(clue2).not.toHaveProperty("leadActor");
    expect(clue2).not.toHaveProperty("releaseYear");

    const clue3 = buildSafeClue("genre", 3, sampleMovie, "s1", "r1", "seed");
    expect(clue3).toEqual({
      mode: "genre",
      genres: ["Animation", "Family", "Fantasy"],
      decade: "2000s",
      originalLanguage: "ja",
      originalLanguageLabel: "Japanese",
      director: "Hayao Miyazaki",
      directors: ["Hayao Miyazaki"],
      leadActor: "Rumi Hiiragi",
      releaseYear: 2001,
    });
  });

  it("never serializes movie title or reveal snapshot in active round DTO", () => {
    const round: DbRound = {
      id: "r-genre",
      session_id: "s-genre",
      ordinal: 1,
      movie_id: 129,
      mode: "genre",
      hint_stage: 1,
      wrong_attempts: 0,
      state: "guessing",
      score: 250,
      reveal_seed: "seed",
    };

    const dto = serializeActiveRound(round, sampleMovie, "s-genre");
    expect(dto.reveal).toBeNull();
    expect(dto.clue).toMatchObject({
      mode: "genre",
      genres: ["Animation", "Family", "Fantasy"],
      decade: "2000s",
      originalLanguage: "ja",
    });
    expect(JSON.stringify(dto)).not.toMatch(/Spirited Away|千と千尋の神隠し|Hayao Miyazaki|Rumi Hiiragi|2001/);
  });
});

describe("Genre Detective mode: UI rendering and accessibility", () => {
  it("renders genres, decade, disclaimer, and progressive clues cleanly", () => {
    const clue = buildSafeClue("genre", 3, sampleMovie, "s1", "r1", "seed");
    render(<ClueRenderer clue={clue} />);

    expect(screen.getByText("Genre Detective")).toBeInTheDocument();
    expect(screen.getByText("Genres")).toBeInTheDocument();
    expect(screen.getByText("Animation")).toBeInTheDocument();
    expect(screen.getByText("Family")).toBeInTheDocument();
    expect(screen.getByText("Fantasy")).toBeInTheDocument();
    expect(
      screen.getByText(/Several films can fit these early clues\. Only the chosen movie is accepted\./)
    ).toBeInTheDocument();

    expect(screen.getByText("Decade")).toBeInTheDocument();
    expect(screen.getByText("2000s")).toBeInTheDocument();

    expect(screen.getByText("Language: Japanese (JA)")).toBeInTheDocument();
    expect(screen.getByText("Director: Hayao Miyazaki")).toBeInTheDocument();
    expect(screen.getByText("Lead: Rumi Hiiragi")).toBeInTheDocument();
    expect(screen.getByText("Year: 2001")).toBeInTheDocument();
  });

  it("renders plural Directors label when movie has co-directors", () => {
    const coDirectedMovie: MovieDetails = {
      ...sampleMovie,
      directors: [
        { id: 1, name: "Joel Coen" },
        { id: 2, name: "Ethan Coen" },
      ],
    };
    const clue = buildSafeClue("genre", 2, coDirectedMovie, "s1", "r1", "seed");
    render(<ClueRenderer clue={clue} />);

    expect(screen.getByText("Directors: Joel Coen, Ethan Coen")).toBeInTheDocument();
  });
});
