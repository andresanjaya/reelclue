import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StatsView } from "../../src/features/stats/stats-view";
import {
  _resetMemoryStorageForTesting,
  recordCompletedSession,
} from "../../src/lib/client/storage";

describe("StatsView component", () => {
  beforeEach(() => {
    window.localStorage.clear();
    _resetMemoryStorageForTesting();
    vi.restoreAllMocks();
  });

  it("renders empty state when no games have been completed", () => {
    render(<StatsView />);

    expect(screen.getByRole("heading", { name: "Device Statistics" })).toBeInTheDocument();
    expect(screen.getByText(/Per-device performance records/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "No games completed yet" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Start Your First Game/ })).toHaveAttribute("href", "/play");
  });

  it("renders overall statistics and breakdown when sessions are recorded", () => {
    recordCompletedSession({
      id: "sess-1",
      mode: "poster",
      level: "easy",
      score: 80,
      correct_count: 8,
      total_rounds: 10,
      total_hints_used: 2,
      total_wrong_attempts: 1,
      rounds: [{ reveal: { tmdb_id: 1 } }],
    });

    recordCompletedSession({
      id: "sess-2",
      mode: "synopsis",
      level: "medium",
      score: 95,
      correct_count: 10,
      total_rounds: 10,
      total_hints_used: 1,
      total_wrong_attempts: 0,
      rounds: [{ reveal: { tmdb_id: 2 } }],
    });

    render(<StatsView />);

    // Overall summary
    expect(screen.getByRole("heading", { name: "Overall Summary" })).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument(); // 2 games played
    expect(screen.getByText("90%")).toBeInTheDocument(); // (8+10)/(10+10) = 18/20 = 90%
    expect(screen.getAllByText("95").length).toBeGreaterThanOrEqual(1); // best score

    // Mode and Level breakdown
    expect(screen.getByRole("heading", { name: "Performance by Mode & Difficulty" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Poster Blur" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Synopsis" })).toBeInTheDocument();
  });

  it("filters breakdown by selected mode and difficulty", () => {
    recordCompletedSession({
      id: "sess-1",
      mode: "poster",
      level: "easy",
      score: 80,
      correct_count: 8,
      total_rounds: 10,
      total_hints_used: 2,
      total_wrong_attempts: 1,
      rounds: [{ reveal: { tmdb_id: 1 } }],
    });

    recordCompletedSession({
      id: "sess-2",
      mode: "synopsis",
      level: "hard",
      score: 60,
      correct_count: 6,
      total_rounds: 10,
      total_hints_used: 4,
      total_wrong_attempts: 3,
      rounds: [{ reveal: { tmdb_id: 2 } }],
    });

    render(<StatsView />);

    // Filter to only Poster
    const modeSelect = screen.getByLabelText("Mode:");
    fireEvent.change(modeSelect, { target: { value: "poster" } });

    expect(screen.getByRole("heading", { name: "Poster Blur" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Synopsis" })).not.toBeInTheDocument();

    // Filter to Hard tier only (none for poster)
    const levelSelect = screen.getByLabelText("Difficulty:");
    fireEvent.change(levelSelect, { target: { value: "hard" } });

    expect(screen.getByText(/No games completed for the selected mode and difficulty filter/)).toBeInTheDocument();
  });

  it("handles clear history flow with confirmation and dismissal", () => {
    recordCompletedSession({
      id: "sess-clear",
      mode: "poster",
      level: "easy",
      score: 80,
      correct_count: 8,
      total_rounds: 10,
      total_hints_used: 2,
      total_wrong_attempts: 1,
      rounds: [{ reveal: { tmdb_id: 1 } }],
    });

    render(<StatsView />);

    expect(screen.getByRole("heading", { name: "Poster Blur" })).toBeInTheDocument();

    // Trigger confirmation dialog
    const clearBtn = screen.getByRole("button", { name: /Clear History/ });
    fireEvent.click(clearBtn);

    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to clear device history\?/)).toBeInTheDocument();

    // Cancel dismissal
    const cancelBtn = screen.getByRole("button", { name: "Cancel" });
    fireEvent.click(cancelBtn);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Poster Blur" })).toBeInTheDocument();

    // Re-open and confirm clear
    fireEvent.click(screen.getByRole("button", { name: /Clear History/ }));
    const confirmBtn = screen.getByRole("button", { name: "Yes, Clear History" });
    fireEvent.click(confirmBtn);

    // Should return to empty state and display cleared notification
    expect(screen.getByRole("heading", { name: "No games completed yet" })).toBeInTheDocument();
    expect(screen.getByText(/Local device statistics and history have been cleared/)).toBeInTheDocument();
  });
});
