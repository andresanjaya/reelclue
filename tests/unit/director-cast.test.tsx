import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { buildSafeClue, type MovieDetails } from "../../src/lib/server/game/clues";
import { serializeActiveRound, type DbRound } from "../../src/lib/server/game/dto";
import { ClueRenderer } from "../../src/features/game/clue-renderer";

const sampleMovie: MovieDetails = {
  tmdb_id: 603,
  title: "The Matrix",
  original_title: "The Matrix",
  release_year: 1999,
  original_language: "en",
  genres: ["Action", "Science Fiction"],
  sanitized_synopsis: "Set in the 22nd century, The Matrix tells the story of a computer hacker who learns from mysterious rebels about the true nature of his reality.",
  directors: [
    { id: 9339, name: "Lana Wachowski" },
    { id: 9340, name: "Lilly Wachowski" },
  ],
  cast_members: [
    { id: 6384, name: "Keanu Reeves" },
    { id: 2975, name: "Laurence Fishburne" },
    { id: 530, name: "Carrie-Anne Moss" },
    { id: 1331, name: "Hugo Weaving" },
  ],
  poster_path: "/matrix.jpg",
};

describe("Director and Cast mode: eligibility and deduplication", () => {
  it("rejects movies without a director or with fewer than 3 distinct cast members", () => {
    expect(() =>
      buildSafeClue("cast", 0, { ...sampleMovie, directors: [] }, "s1", "r1", "seed")
    ).toThrow("not eligible for Director & Cast mode");

    expect(() =>
      buildSafeClue(
        "cast",
        0,
        {
          ...sampleMovie,
          cast_members: [
            { id: 1, name: "Actor One" },
            { id: 2, name: "Actor Two" },
          ],
        },
        "s1",
        "r1",
        "seed"
      )
    ).toThrow("not eligible for Director & Cast mode");
  });

  it("deduplicates cast identities while preserving billed ordering rank", () => {
    const movieWithDupes: MovieDetails = {
      ...sampleMovie,
      cast_members: [
        { id: 10, name: "Top Star" },
        { id: 10, name: "Top Star (dual role)" },
        { id: 20, name: "Co-Star" },
        { id: 30, name: "Supporting Actor" },
      ],
    };

    const clue = buildSafeClue("cast", 3, movieWithDupes, "s1", "r1", "seed");
    expect(clue.mode).toBe("cast");
    if (clue.mode === "cast") {
      expect(clue.cast).toEqual(["Top Star", "Co-Star", "Supporting Actor"]);
    }
  });

  it("handles co-directors and deduplicates director list without placeholders", () => {
    const movieWithCoDirectors: MovieDetails = {
      ...sampleMovie,
      directors: [
        { id: 1, name: "Joel Coen" },
        { id: 2, name: "Ethan Coen" },
        { id: 1, name: "Joel Coen" },
      ],
    };

    const clue = buildSafeClue("cast", 0, movieWithCoDirectors, "s1", "r1", "seed");
    expect(clue.mode).toBe("cast");
    if (clue.mode === "cast") {
      expect(clue.director).toBe("Joel Coen, Ethan Coen");
      expect(clue.directors).toEqual(["Joel Coen", "Ethan Coen"]);
      expect(clue.director).not.toContain("Unknown");
    }
  });
});

describe("Director and Cast mode: progressive reveals and security", () => {
  it("strictly reveals director at stage 0, +1 cast at stage 1, +2 cast at stage 2, +3 cast and year at stage 3", () => {
    const clue0 = buildSafeClue("cast", 0, sampleMovie, "s1", "r1", "seed");
    expect(clue0).toEqual({
      mode: "cast",
      director: "Lana Wachowski, Lilly Wachowski",
      directors: ["Lana Wachowski", "Lilly Wachowski"],
    });

    const clue1 = buildSafeClue("cast", 1, sampleMovie, "s1", "r1", "seed");
    expect(clue1).toMatchObject({
      mode: "cast",
      director: "Lana Wachowski, Lilly Wachowski",
      directors: ["Lana Wachowski", "Lilly Wachowski"],
      cast: ["Keanu Reeves"],
    });
    expect(clue1).not.toHaveProperty("releaseYear");

    const clue2 = buildSafeClue("cast", 2, sampleMovie, "s1", "r1", "seed");
    expect(clue2).toMatchObject({
      mode: "cast",
      director: "Lana Wachowski, Lilly Wachowski",
      cast: ["Keanu Reeves", "Laurence Fishburne"],
    });
    expect(clue2).not.toHaveProperty("releaseYear");

    const clue3 = buildSafeClue("cast", 3, sampleMovie, "s1", "r1", "seed");
    expect(clue3).toEqual({
      mode: "cast",
      director: "Lana Wachowski, Lilly Wachowski",
      directors: ["Lana Wachowski", "Lilly Wachowski"],
      cast: ["Keanu Reeves", "Laurence Fishburne", "Carrie-Anne Moss"],
      releaseYear: 1999,
    });
    expect(JSON.stringify(clue3)).not.toMatch(/The Matrix|Hugo Weaving/);
  });

  it("never serializes title, reveal snapshot, or 4th billed actor in active session DTO", () => {
    const round: DbRound = {
      id: "r-cast",
      session_id: "s-cast",
      ordinal: 1,
      movie_id: 603,
      mode: "cast",
      hint_stage: 2,
      wrong_attempts: 0,
      state: "guessing",
      score: 200,
      reveal_seed: "seed",
    };

    const dto = serializeActiveRound(round, sampleMovie, "s-cast");
    expect(dto.reveal).toBeNull();
    expect(dto.clue).toMatchObject({
      mode: "cast",
      cast: ["Keanu Reeves", "Laurence Fishburne"],
    });
    expect(JSON.stringify(dto)).not.toMatch(/The Matrix|Carrie-Anne Moss|Hugo Weaving|1999/);
  });
});

describe("Director and Cast mode: UI rendering and accessibility", () => {
  it("renders co-directors, warning note, and billed order numbers cleanly", () => {
    const clue = buildSafeClue("cast", 3, sampleMovie, "s1", "r1", "seed");
    render(<ClueRenderer clue={clue} />);

    expect(screen.getByText("Director & Cast")).toBeInTheDocument();
    expect(screen.getByText("Directors")).toBeInTheDocument();
    expect(screen.getByText("Lana Wachowski, Lilly Wachowski")).toBeInTheDocument();
    expect(
      screen.getByText(/Several films can fit these early credits\. Only the chosen movie is accepted\./)
    ).toBeInTheDocument();

    expect(screen.getByText("Billed Cast Members")).toBeInTheDocument();
    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.getByText("Keanu Reeves")).toBeInTheDocument();
    expect(screen.getByText("#2")).toBeInTheDocument();
    expect(screen.getByText("Laurence Fishburne")).toBeInTheDocument();
    expect(screen.getByText("#3")).toBeInTheDocument();
    expect(screen.getByText("Carrie-Anne Moss")).toBeInTheDocument();
    expect(screen.getByText("Release Year: 1999")).toBeInTheDocument();
  });

  it("renders singular Director label when movie has a single director", () => {
    const singleDirectorMovie: MovieDetails = {
      ...sampleMovie,
      directors: [{ id: 1, name: "Christopher Nolan" }],
    };
    const clue = buildSafeClue("cast", 0, singleDirectorMovie, "s1", "r1", "seed");
    render(<ClueRenderer clue={clue} />);

    expect(screen.getByText("Director")).toBeInTheDocument();
    expect(screen.queryByText("Directors")).not.toBeInTheDocument();
    expect(screen.getByText("Christopher Nolan")).toBeInTheDocument();
  });
});
