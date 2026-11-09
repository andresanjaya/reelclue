import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  executeShare,
  formatEmojiGrid,
  generateSpoilerFreeSharePayload,
  getRoundOutcomeEmoji,
  getRoundOutcomeText,
  type SharePayloadOptions,
  type ShareRoundSummary,
} from "../../src/lib/client/sharing";

describe("Spoiler-free sharing utility", () => {
  const sampleRounds: ShareRoundSummary[] = [
    { ordinal: 1, outcome: "correct", hintsUsed: 0, wrongAttempts: 0 },
    { ordinal: 2, outcome: "correct", hintsUsed: 1, wrongAttempts: 0 },
    { ordinal: 3, outcome: "correct", hintsUsed: 0, wrongAttempts: 2 },
    { ordinal: 4, outcome: "exhausted", hintsUsed: 3, wrongAttempts: 3 },
    { ordinal: 5, outcome: "skipped", hintsUsed: 0, wrongAttempts: 0 },
    { ordinal: 6, outcome: "correct", hintsUsed: 0, wrongAttempts: 0 },
    { ordinal: 7, outcome: "correct", hintsUsed: 2, wrongAttempts: 1 },
    { ordinal: 8, outcome: "correct", hintsUsed: 0, wrongAttempts: 0 },
    { ordinal: 9, outcome: "exhausted", hintsUsed: 2, wrongAttempts: 3 },
    { ordinal: 10, outcome: "correct", hintsUsed: 0, wrongAttempts: 0 },
  ];

  it("maps round outcomes to distinct emoji indicators", () => {
    // Correct with 0 hints and 0 wrong = 🟩
    expect(getRoundOutcomeEmoji(sampleRounds[0])).toBe("🟩");
    // Correct with 1 hint = 🟨
    expect(getRoundOutcomeEmoji(sampleRounds[1])).toBe("🟨");
    // Correct with 2 wrong attempts = 🟨
    expect(getRoundOutcomeEmoji(sampleRounds[2])).toBe("🟨");
    // Exhausted = 🟥
    expect(getRoundOutcomeEmoji(sampleRounds[3])).toBe("🟥");
    // Skipped = ⬜
    expect(getRoundOutcomeEmoji(sampleRounds[4])).toBe("⬜");
  });

  it("formats accessible non-color-only text description for each round", () => {
    expect(getRoundOutcomeText(sampleRounds[0])).toBe("Round 1: Solved (0 hints, 0 wrong)");
    expect(getRoundOutcomeText(sampleRounds[1])).toBe("Round 2: Solved (1 hint, 0 wrong)");
    expect(getRoundOutcomeText(sampleRounds[3])).toBe("Round 4: Missed (Exhausted)");
    expect(getRoundOutcomeText(sampleRounds[4])).toBe("Round 5: Skipped");
  });

  it("formats emoji grid in 5-column rows for clean mobile wrapping", () => {
    const grid = formatEmojiGrid(sampleRounds);
    const rows = grid.split("\n");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toBe("🟩🟨🟨🟥⬜");
    expect(rows[1]).toBe("🟩🟨🟩🟥🟩");
  });

  describe("generateSpoilerFreeSharePayload", () => {
    const opts: SharePayloadOptions = {
      mode: "poster",
      level: "medium",
      score: 750,
      maxScore: 1500,
      correctCount: 7,
      totalRounds: 10,
      rounds: sampleRounds,
      origin: "https://reelclue.vercel.app",
    };

    it("never includes movie titles, posters, aliases, or private session IDs in payload", () => {
      const payload = generateSpoilerFreeSharePayload(opts);

      // Verify no titles or private paths
      expect(payload.fullMessage).not.toContain("Inception");
      expect(payload.fullMessage).not.toContain("poster");
      expect(payload.fullMessage).not.toContain(".jpg");
      expect(payload.fullMessage).not.toContain("tmdb");
      expect(payload.fullMessage).not.toContain("session");
      expect(payload.fullMessage).not.toContain("token");

      // Verify generic link only
      expect(payload.url).toBe("https://reelclue.vercel.app/play");
      expect(payload.fullMessage).toContain("Play ReelClue: https://reelclue.vercel.app/play");
      expect(payload.fullMessage).not.toContain("/play/");
      expect(payload.fullMessage).not.toContain("/results/");
    });

    it("includes summary scores and accessible textual breakdown", () => {
      const payload = generateSpoilerFreeSharePayload(opts);

      expect(payload.title).toBe("ReelClue — Poster (Medium)");
      expect(payload.fullMessage).toContain("Score: 750/1500 (7/10 correct)");
      expect(payload.fullMessage).toContain("🟩🟨🟨🟥⬜");
      expect(payload.fullMessage).toContain("Round 1: Solved (0 hints, 0 wrong)");
      expect(payload.fullMessage).toContain("Round 4: Missed (Exhausted)");
      expect(payload.fullMessage).toContain("Round 5: Skipped");
    });

    it("formats Daily Challenge payload with date and daily URL", () => {
      const dailyOpts: SharePayloadOptions = {
        ...opts,
        isDaily: true,
        dailyDate: "2026-11-09",
      };

      const payload = generateSpoilerFreeSharePayload(dailyOpts);
      expect(payload.title).toBe("ReelClue Daily (2026-11-09)");
      expect(payload.url).toBe("https://reelclue.vercel.app/daily");
      expect(payload.fullMessage).toContain("https://reelclue.vercel.app/daily");
    });
  });

  describe("executeShare with progressive enhancement", () => {
    const originalNavigator = globalThis.navigator;

    beforeEach(() => {
      vi.clearAllMocks();
    });

    afterEach(() => {
      Object.defineProperty(globalThis, "navigator", {
        value: originalNavigator,
        configurable: true,
        writable: true,
      });
    });

    it("uses navigator.share when available and succeeds", async () => {
      const mockShare = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(globalThis, "navigator", {
        value: { share: mockShare },
        configurable: true,
        writable: true,
      });

      const res = await executeShare({
        title: "Test",
        text: "Summary",
        url: "https://reelclue.vercel.app",
        fullMessage: "Full share text",
      });

      expect(mockShare).toHaveBeenCalledWith({
        title: "Test",
        text: "Full share text",
      });
      expect(res).toEqual({ type: "shared" });
    });

    it("handles user cancellation (AbortError) gracefully without reporting an error", async () => {
      const abortError = new Error("Share cancelled");
      abortError.name = "AbortError";
      const mockShare = vi.fn().mockRejectedValue(abortError);

      Object.defineProperty(globalThis, "navigator", {
        value: { share: mockShare },
        configurable: true,
        writable: true,
      });

      const res = await executeShare({
        title: "Test",
        text: "Summary",
        url: "https://reelclue.vercel.app",
        fullMessage: "Full share text",
      });

      expect(res).toEqual({ type: "cancelled" });
    });

    it("falls back to clipboard when navigator.share is unavailable", async () => {
      const mockWriteText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(globalThis, "navigator", {
        value: {
          clipboard: { writeText: mockWriteText },
        },
        configurable: true,
        writable: true,
      });

      const res = await executeShare({
        title: "Test",
        text: "Summary",
        url: "https://reelclue.vercel.app",
        fullMessage: "Full share text",
      });

      expect(mockWriteText).toHaveBeenCalledWith("Full share text");
      expect(res).toEqual({ type: "copied" });
    });

    it("returns error with manual copy instruction when clipboard fails", async () => {
      const mockWriteText = vi.fn().mockRejectedValue(new Error("Permission denied"));
      Object.defineProperty(globalThis, "navigator", {
        value: {
          clipboard: { writeText: mockWriteText },
        },
        configurable: true,
        writable: true,
      });

      const res = await executeShare({
        title: "Test",
        text: "Summary",
        url: "https://reelclue.vercel.app",
        fullMessage: "Full share text",
      });

      expect(res.type).toBe("error");
      if (res.type === "error") {
        expect(res.message).toContain("Unable to copy to clipboard automatically");
      }
    });
  });
});

