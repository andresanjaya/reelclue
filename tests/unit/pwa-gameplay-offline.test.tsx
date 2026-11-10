import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameplayShell } from "@/features/game/gameplay-shell";
import { PlaySetup } from "@/features/game/play-setup";
import type { SafeSessionDto } from "@/lib/server/game/dto";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
}));

const mockActiveRound: SafeSessionDto["active_round"] = {
  id: "round-1",
  ordinal: 1,
  mode: "poster",
  hint_stage: 0,
  wrong_attempts: 0,
  score: 0,
  state: "guessing",
  clue: {
    mode: "poster",
    posterUrl: "/api/games/session-1/poster?round=1&stage=0",
  },
  reveal: null,
};

const mockSession: SafeSessionDto = {
  id: "session-1",
  mode: "poster",
  level: "easy",
  state: "active",
  current_round: 1,
  score: 0,
  revision: 1,
  active_round: mockActiveRound,
  completed_rounds: [],
};

describe("PWA Gameplay Offline Resiliency", () => {
  const originalOnLine = navigator.onLine;

  beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(navigator, "onLine", {
      value: true,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, "onLine", {
      value: originalOnLine,
      configurable: true,
      writable: true,
    });
  });

  it("does not claim submitted guess succeeded while offline and prevents network fetch", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockSession,
    } as Response);

    render(<GameplayShell sessionId="session-1" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Submit Guess/i })).toBeInTheDocument();
    });

    // Enter guess
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "Fight Club" } });

    // Set offline
    Object.defineProperty(navigator, "onLine", {
      value: false,
      configurable: true,
      writable: true,
    });

    // Attempt to submit guess
    fireEvent.click(screen.getByRole("button", { name: /Submit Guess/i }));

    // Verify offline error is displayed
    await waitFor(() => {
      expect(
        screen.getByText(/You appear to be offline. Reconnect to the internet to submit your guess/i)
      ).toBeInTheDocument();
    });

    // Verify that NO post fetch to /guess was made
    const guessCalls = fetchSpy.mock.calls.filter((call) =>
      typeof call[0] === "string" && call[0].includes("/guess")
    );
    expect(guessCalls).toHaveLength(0);

    // Verify score did not change and round is still guessing (server remains authoritative)
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("blocks requesting hint while offline", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockSession,
    } as Response);

    render(<GameplayShell sessionId="session-1" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Hint 1/i })).toBeInTheDocument();
    });

    // Set offline
    Object.defineProperty(navigator, "onLine", {
      value: false,
      configurable: true,
      writable: true,
    });

    fireEvent.click(screen.getByRole("button", { name: /Hint 1/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/You appear to be offline. Reconnect to the internet to request a hint/i)
      ).toBeInTheDocument();
    });

    const hintCalls = fetchSpy.mock.calls.filter((call) =>
      typeof call[0] === "string" && call[0].includes("/hint")
    );
    expect(hintCalls).toHaveLength(0);
  });

  it("resumes and resyncs authoritative session state from server upon reconnect", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
      // Initial load
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSession,
      } as Response)
      // Reconnect resync GET /api/games/session-1
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          ...mockSession,
          score: 80,
          revision: 2,
        }),
      } as Response);

    render(<GameplayShell sessionId="session-1" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Submit Guess/i })).toBeInTheDocument();
    });

    // Trigger reconnect (window online event)
    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });

    await waitFor(() => {
      // resyncSession was invoked
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/games/session-1",
        expect.objectContaining({ headers: { Accept: "application/json" } })
      );
      // State updated from server
      expect(screen.getByText(/Session state synced with server/i)).toBeInTheDocument();
      expect(screen.getByText("80")).toBeInTheDocument();
    });
  });

  it("prevents starting a new game while offline in PlaySetup", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    Object.defineProperty(navigator, "onLine", {
      value: false,
      configurable: true,
      writable: true,
    });

    render(<PlaySetup />);

    const startBtn = screen.getByRole("button", { name: /Start Game/i });
    fireEvent.click(startBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/You appear to be offline. Please connect to the internet to start a game/i)
      ).toBeInTheDocument();
    });

    const postCalls = fetchSpy.mock.calls.filter((call) =>
      typeof call[0] === "string" && call[0].includes("/api/games")
    );
    expect(postCalls).toHaveLength(0);
  });
});
