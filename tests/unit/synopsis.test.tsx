import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { cleanText, sanitizeSynopsis } from "../../src/lib/server/catalog/text";
import { buildSafeClue, clipSynopsis, type MovieDetails } from "../../src/lib/server/game/clues";
import { serializeActiveRound, type DbRound } from "../../src/lib/server/game/dto";
import { ClueRenderer } from "../../src/features/game/clue-renderer";

const story =
  "A quiet detective returns to a forgotten coastal town to investigate the sudden disappearance of a local lighthouse keeper before winter arrives and cuts off the island entirely.";

const baseMovie: MovieDetails = {
  tmdb_id: 881,
  title: "The Secret Lighthouse",
  original_title: "El Faro Secreto",
  release_year: 1994,
  original_language: "es",
  genres: ["Mystery", "Thriller"],
  sanitized_synopsis: story,
  directors: [{ id: 4, name: "Guillermo Navarro" }],
  cast_members: [
    { id: 10, name: "Antonio Banderas" },
    { id: 11, name: "Penélope Cruz" },
  ],
  poster_path: "/lighthouse.jpg",
};

describe("Synopsis mode: sanitization and redaction", () => {
  it("redacts full canonical, original, and approved multiword aliases with Unicode boundaries", () => {
    const raw = `In EL FARO SECRETO, a detective discovers that The Secret Lighthouse is not what it seems. An approved alias like The Coastal Keeper also applies. ${story}`;
    const sanitized = sanitizeSynopsis(raw, [
      "The Secret Lighthouse",
      "El Faro Secreto",
      "The Coastal Keeper",
    ]);
    expect(sanitized).not.toBeNull();
    expect(sanitized).toContain("[movie]");
    expect(sanitized).not.toMatch(/the secret lighthouse|el faro secreto|the coastal keeper/i);
  });

  it("preserves ordinary words that appear in a multiword title when used alone", () => {
    const raw = `Eight-year-old Kevin is accidentally left home alone when his family flies away. He stays in his home and sets traps. ${story}`;
    const sanitized = sanitizeSynopsis(raw, ["Home Alone"]);
    expect(sanitized).not.toBeNull();
    expect(sanitized).toContain("[movie]");
    // "home alone" is redacted, but solitary "home" is preserved
    expect(sanitized).toContain("He stays in his home and sets traps.");
  });

  it("handles accented titles and possessives without leaking title", () => {
    const raw = `Amélie's whimsical quest brings unexpected joy to those around her in Paris. AMÉLIE is beloved by all. ${story}`;
    const sanitized = sanitizeSynopsis(raw, ["Amélie"]);
    expect(sanitized).not.toBeNull();
    expect(sanitized).toContain("[movie]'s whimsical quest");
    expect(sanitized).not.toMatch(/amélie|amelie/i);
  });

  it("disqualifies synopsis when a short alias (< 4 chars) or common word is present", () => {
    expect(sanitizeSynopsis(story, ["Up"])).toBeNull();
    expect(sanitizeSynopsis(story, ["It"])).toBeNull();
    expect(sanitizeSynopsis(story, ["Her"])).toBeNull();
    expect(sanitizeSynopsis(story, ["The Secret Lighthouse", "love"])).toBeNull();
    expect(sanitizeSynopsis(story, ["The Secret Lighthouse", "dark"])).toBeNull();
  });

  it("disqualifies synopsis if over-redacted with too many [movie] tags", () => {
    const raw = `The Secret Lighthouse meets The Secret Lighthouse in The Secret Lighthouse where The Secret Lighthouse and The Secret Lighthouse happen. ${story}`;
    expect(sanitizeSynopsis(raw, ["The Secret Lighthouse"])).toBeNull();
  });

  it("strips HTML tags and script/style contents while rejecting malformed markup", () => {
    expect(cleanText("<p>A valid story.</p><script>evil()</script>")).toBe("A valid story.");
    expect(cleanText("Broken <markup without close")).toBeNull();
    expect(cleanText("Unknown &flurble; entity")).toBeNull();
  });

  it("enforces minimum 100 character length and clips cleanly at <= 600 characters", () => {
    expect(sanitizeSynopsis("Too short synopsis.", ["The Secret Lighthouse"])).toBeNull();
    const longSynopsis = (story + " ").repeat(6);
    const sanitized = sanitizeSynopsis(longSynopsis, ["The Secret Lighthouse"]);
    expect(sanitized).not.toBeNull();
    expect(sanitized!.length).toBeLessThanOrEqual(600);
    expect(sanitized!.length).toBeGreaterThanOrEqual(100);
    expect(sanitized).not.toMatch(/\s$/);
  });
});

describe("Synopsis mode: server eligibility and hint progression", () => {
  it("rejects movies with missing synopsis, < 100 chars, no director, or no genres", () => {
    expect(() =>
      buildSafeClue("synopsis", 0, { ...baseMovie, sanitized_synopsis: null }, "s1", "r1", "seed")
    ).toThrow("not eligible for Synopsis mode");

    expect(() =>
      buildSafeClue("synopsis", 0, { ...baseMovie, sanitized_synopsis: "Too short." }, "s1", "r1", "seed")
    ).toThrow("not eligible for Synopsis mode");

    expect(() =>
      buildSafeClue("synopsis", 0, { ...baseMovie, directors: [] }, "s1", "r1", "seed")
    ).toThrow("not eligible for Synopsis mode");

    expect(() =>
      buildSafeClue("synopsis", 0, { ...baseMovie, genres: [] }, "s1", "r1", "seed")
    ).toThrow("not eligible for Synopsis mode");
  });

  it("reveals decade at stage 1, genre at stage 2, and director at stage 3 without leaking title", () => {
    const clue0 = buildSafeClue("synopsis", 0, baseMovie, "s1", "r1", "seed");
    expect(clue0).toEqual({
      mode: "synopsis",
      synopsis: story,
    });
    expect(JSON.stringify(clue0)).not.toMatch(/The Secret Lighthouse|El Faro Secreto|1994|Mystery|Navarro/);

    const clue1 = buildSafeClue("synopsis", 1, baseMovie, "s1", "r1", "seed");
    expect(clue1).toMatchObject({
      mode: "synopsis",
      synopsis: story,
      decade: "1990s",
    });
    expect(clue1).not.toHaveProperty("primaryGenre");
    expect(clue1).not.toHaveProperty("director");

    const clue2 = buildSafeClue("synopsis", 2, baseMovie, "s1", "r1", "seed");
    expect(clue2).toMatchObject({
      mode: "synopsis",
      synopsis: story,
      decade: "1990s",
      primaryGenre: "Mystery",
    });
    expect(clue2).not.toHaveProperty("director");

    const clue3 = buildSafeClue("synopsis", 3, baseMovie, "s1", "r1", "seed");
    expect(clue3).toEqual({
      mode: "synopsis",
      synopsis: story,
      decade: "1990s",
      primaryGenre: "Mystery",
      director: "Guillermo Navarro",
    });
    expect(JSON.stringify(clue3)).not.toMatch(/The Secret Lighthouse|El Faro Secreto/);
  });

  it("never serializes title or reveal during active round in safe session DTO", () => {
    const round: DbRound = {
      id: "r1",
      session_id: "s1",
      ordinal: 1,
      movie_id: 881,
      mode: "synopsis",
      hint_stage: 2,
      wrong_attempts: 1,
      state: "guessing",
      score: 180,
      reveal_seed: "seed",
    };
    const dto = serializeActiveRound(round, baseMovie, "s1");
    expect(dto.reveal).toBeNull();
    expect(dto.clue).toMatchObject({
      mode: "synopsis",
      decade: "1990s",
      primaryGenre: "Mystery",
    });
    expect(JSON.stringify(dto)).not.toMatch(/The Secret Lighthouse|El Faro Secreto|lighthouse\.jpg/);
  });

  it("clips at sentence or word boundaries and respects max length strictly", () => {
    const textWithExclamation = "A grand adventure begins! An ancient secret awaits the brave heroes who venture forth. ".repeat(10);
    const clipped = clipSynopsis(textWithExclamation, 600);
    expect(clipped.length).toBeLessThanOrEqual(600);
    expect(clipped).toMatch(/[.!?]$/);
  });
});

describe("Synopsis mode: UI rendering and mobile responsiveness", () => {
  it("renders quote styling and hint tags without leaking titles", () => {
    const clue = buildSafeClue("synopsis", 3, baseMovie, "s1", "r1", "seed");
    render(<ClueRenderer clue={clue} />);

    expect(screen.getByText("Plot Synopsis")).toBeInTheDocument();
    expect(screen.getByText(/A quiet detective returns/)).toBeInTheDocument();
    expect(screen.getByText("Era: 1990s")).toBeInTheDocument();
    expect(screen.getByText("Genre: Mystery")).toBeInTheDocument();
    expect(screen.getByText("Director: Guillermo Navarro")).toBeInTheDocument();

    const blockquote = screen.getByText(/A quiet detective returns/).closest("blockquote");
    expect(blockquote).toHaveClass("wrap-anywhere", "min-w-0");
  });
});
