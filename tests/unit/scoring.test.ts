// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { normalizeTitle, validateGuessInput } from "../../src/lib/game-rules/normalization.ts";
import { calculateRoundScore, BASE_SCORES } from "../../src/lib/game-rules/scoring.ts";
import { encodeChoiceHandle, decodeChoiceHandle } from "../../src/lib/server/game/choiceHandle.ts";

describe("Title normalization per PRD Section 7", () => {
  it("normalizes diacritics and Unicode characters with NFKD", () => {
    expect(normalizeTitle("Amélie")).toBe("amelie");
    expect(normalizeTitle("WALL·E")).toBe("walle");
    expect(normalizeTitle("Pokémon: The First Movie")).toBe("pokemon the first movie");
  });

  it("converts & to 'and' and collapses whitespace", () => {
    expect(normalizeTitle("Fast & Furious")).toBe("fast and furious");
    expect(normalizeTitle("  Dumb   &   Dumber  ")).toBe("dumb and dumber");
    expect(normalizeTitle("Birds of Prey & the Fantabulous Emancipation")).toBe("birds of prey and the fantabulous emancipation");
  });

  it("removes punctuation while preserving letters and digits", () => {
    expect(normalizeTitle("Spider-Man: No Way Home")).toBe("spiderman no way home");
    expect(normalizeTitle("Mission: Impossible - Fallout")).toBe("mission impossible fallout");
    expect(normalizeTitle("Oppenheimer (2023)")).toBe("oppenheimer 2023");
  });

  it("preserves numbers and sequel distinctions", () => {
    expect(normalizeTitle("Iron Man 2")).toBe("iron man 2");
    expect(normalizeTitle("Iron Man")).toBe("iron man");
    expect(normalizeTitle("Iron Man 2")).not.toBe(normalizeTitle("Iron Man"));

    expect(normalizeTitle("Se7en")).toBe("se7en");
    expect(normalizeTitle("2001: A Space Odyssey")).toBe("2001 a space odyssey");
    expect(normalizeTitle("Toy Story 4")).toBe("toy story 4");
  });

  it("preserves leading articles and does not auto-convert roman numerals", () => {
    expect(normalizeTitle("The Dark Knight")).toBe("the dark knight");
    expect(normalizeTitle("A Beautiful Mind")).toBe("a beautiful mind");
    expect(normalizeTitle("The Godfather Part II")).toBe("the godfather part ii");
  });
});

describe("Guess input validation", () => {
  it("rejects blank or whitespace-only inputs", () => {
    expect(validateGuessInput("").valid).toBe(false);
    expect(validateGuessInput("    ").valid).toBe(false);
    expect(validateGuessInput("\t\n").valid).toBe(false);
  });

  it("rejects inputs longer than 150 characters", () => {
    const tooLong = "A".repeat(151);
    const result = validateGuessInput(tooLong);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("150 characters");
  });

  it("rejects inputs with only punctuation or symbols", () => {
    expect(validateGuessInput("---").valid).toBe(false);
    expect(validateGuessInput("???").valid).toBe(false);
    expect(validateGuessInput("!@#$%^&*()").valid).toBe(false);
  });

  it("accepts valid inputs and returns normalized text", () => {
    const result = validateGuessInput("  Inception!  ");
    expect(result.valid).toBe(true);
    expect(result.normalized).toBe("inception");
  });
});

describe("Scoring formula calculation", () => {
  it("enforces base scores: Easy=100, Medium=150, Hard=200", () => {
    expect(BASE_SCORES.easy).toBe(100);
    expect(BASE_SCORES.medium).toBe(150);
    expect(BASE_SCORES.hard).toBe(200);

    expect(calculateRoundScore("easy", 0, 0)).toBe(100);
    expect(calculateRoundScore("medium", 0, 0)).toBe(150);
    expect(calculateRoundScore("hard", 0, 0)).toBe(200);
  });

  it("deducts 25 points per wrong attempt and 20 points per hint", () => {
    // Easy: 100 - 25*1 - 20*1 = 55
    expect(calculateRoundScore("easy", 1, 1)).toBe(55);
    // Medium: 150 - 25*2 - 20*1 = 150 - 50 - 20 = 80
    expect(calculateRoundScore("medium", 2, 1)).toBe(80);
    // Hard: 200 - 25*1 - 20*3 = 200 - 25 - 60 = 115
    expect(calculateRoundScore("hard", 1, 3)).toBe(115);
  });

  it("clamps score at 0 without promising a minimum", () => {
    // 2 wrong attempts (50) + 3 hints (60) on Easy (100) = 100 - 110 = -10 -> 0
    expect(calculateRoundScore("easy", 2, 3)).toBe(0);
    // 2 wrong attempts (50) + 2 hints (40) on Easy (100) = 10 points
    expect(calculateRoundScore("easy", 2, 2)).toBe(10);
  });
});

describe("Choice handle encryption and tamper resistance", () => {
  it("encodes and decodes positive integer movie IDs cleanly", () => {
    const handle = encodeChoiceHandle(101);
    expect(typeof handle).toBe("string");
    expect(handle).toContain(".");
    expect(decodeChoiceHandle(handle)).toBe(101);
  });

  it("rejects tampered or forged signatures", () => {
    const valid = encodeChoiceHandle(505);
    const [payload] = valid.split(".");
    const tampered = `${payload}.forgedsignature`;
    expect(decodeChoiceHandle(tampered)).toBeNull();
  });

  it("rejects invalid, malformed, or empty strings", () => {
    expect(decodeChoiceHandle("")).toBeNull();
    expect(decodeChoiceHandle("malformed")).toBeNull();
    expect(decodeChoiceHandle("a.b.c")).toBeNull();
  });
});
