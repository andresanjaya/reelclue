import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResultsView } from "../../src/features/game/results-view";
import type { GameResultsDto } from "../../src/lib/server/game/dto";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

describe("ResultsView spoiler-free sharing UI", () => {
  const originalNavigator = globalThis.navigator;

  const sampleResults: GameResultsDto = {
    id: "session-secret-uuid-123",
    mode: "synopsis",
    level: "easy",
    state: "completed",
    score: 850,
    max_score: 1000,
    accuracy: 90,
    correct_count: 9,
    total_rounds: 10,
    total_hints_used: 3,
    total_wrong_attempts: 2,
    completed_at: "2026-11-09T12:00:00Z",
    rounds: Array.from({ length: 10 }, (_, i) => ({
      ordinal: i + 1,
      mode: "synopsis",
      reveal: {
        tmdb_id: 500 + i,
        title: `Secret Movie Title ${i + 1}`,
        original_title: `Original Secret ${i + 1}`,
        release_year: 2020,
        genres: ["Drama"],
        directors: ["Director A"],
        cast: ["Actor B"],
        synopsis: "Secret synopsis",
        poster_path: `/secret-poster-${i}.jpg`,
        outcome: i === 9 ? "exhausted" : "correct",
        score: i === 9 ? 0 : 90,
        hints_used: i < 3 ? 1 : 0,
        wrong_attempts: i === 9 ? 3 : 0,
      },
    })),
  };

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

  it("renders round outcome grid with accessible labels for all 10 rounds", () => {
    render(<ResultsView results={sampleResults} />);

    expect(screen.getByText("Round Outcome Grid")).toBeInTheDocument();
    expect(screen.getByText("9 of 10 Solved")).toBeInTheDocument();

    // Check all 10 round items exist
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(10);

    // Verify non-color accessible labels
    expect(items[0]).toHaveAttribute("aria-label", "Round 1: Solved (1 hint, 0 wrong)");
    expect(items[9]).toHaveAttribute("aria-label", "Round 10: Missed (Exhausted)");
  });

  it("renders Share Results button with accessible minimum touch target", () => {
    render(<ResultsView results={sampleResults} />);

    const shareBtn = screen.getByRole("button", { name: /Share results/i });
    expect(shareBtn).toBeInTheDocument();
    expect(shareBtn.className).toContain("min-h-11");
  });

  it("copies spoiler-free payload to clipboard and displays polite feedback", async () => {
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis, "navigator", {
      value: { clipboard: { writeText: mockWriteText } },
      configurable: true,
      writable: true,
    });

    render(<ResultsView results={sampleResults} />);

    const shareBtn = screen.getByRole("button", { name: /Share results/i });
    fireEvent.click(shareBtn);

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalled();
    });

    const sharedText = mockWriteText.mock.calls[0][0];

    // Assert that the shared string NEVER contains secret titles, posters, or session IDs
    expect(sharedText).not.toContain("Secret Movie Title");
    expect(sharedText).not.toContain("secret-poster");
    expect(sharedText).not.toContain("session-secret-uuid-123");
    expect(sharedText).toContain("Score: 850/1000 (9/10 correct)");

    // Polite feedback message displayed
    expect(
      screen.getByText("Results copied to clipboard (spoiler-free)!")
    ).toBeInTheDocument();
  });

  it("displays manual copy textarea when sharing/clipboard fails", async () => {
    const mockWriteText = vi.fn().mockRejectedValue(new Error("Permission denied"));
    Object.defineProperty(globalThis, "navigator", {
      value: { clipboard: { writeText: mockWriteText } },
      configurable: true,
      writable: true,
    });

    render(<ResultsView results={sampleResults} />);

    const shareBtn = screen.getByRole("button", { name: /Share results/i });
    fireEvent.click(shareBtn);

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/Unable to copy to clipboard automatically/);
    });

    // Manual copy textarea should be visible
    const textarea = screen.getByLabelText("Shareable results text") as HTMLTextAreaElement;
    expect(textarea).toBeInTheDocument();
    expect(textarea.value).toContain("Score: 850/1000");
  });
});
