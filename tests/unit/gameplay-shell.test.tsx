import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClueRenderer } from "../../src/features/game/clue-renderer";
import {
  gameplayReducer,
  initialGameplayState,
  type GameplayState,
} from "../../src/features/game/gameplay-reducer";
import { GameplayShell } from "../../src/features/game/gameplay-shell";
import { getHintDetails } from "../../src/features/game/hint-helpers";
import { TerminalRevealView } from "../../src/features/game/terminal-reveal-view";
import type { SafeSessionDto, TerminalReveal } from "../../src/lib/server/game/dto";

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

const mockTerminalReveal: TerminalReveal = {
  tmdb_id: 550,
  title: "Fight Club",
  original_title: "Fight Club",
  release_year: 1999,
  genres: ["Drama"],
  directors: ["David Fincher"],
  cast: ["Brad Pitt", "Edward Norton", "Helena Bonham Carter"],
  synopsis: "An insomniac office worker...",
  poster_path: "/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg",
  outcome: "correct",
  wrong_attempts: 1,
  hints_used: 1,
  score: 60,
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

describe("Hint Helpers", () => {
  it("returns progressive hint labels and penalties for poster mode", () => {
    const hint0 = getHintDetails("poster", 0);
    expect(hint0.remaining).toBe(3);
    expect(hint0.label).toContain("Hint 1");
    expect(hint0.label).toContain("-20 pts");

    const hint1 = getHintDetails("poster", 1);
    expect(hint1.remaining).toBe(2);
    expect(hint1.label).toContain("Hint 2");

    const hint2 = getHintDetails("poster", 2);
    expect(hint2.remaining).toBe(1);
    expect(hint2.label).toContain("Hint 3");

    const hint3 = getHintDetails("poster", 3);
    expect(hint3.remaining).toBe(0);
    expect(hint3.label).toBe("No hints remaining");
  });
});

describe("ClueRenderer", () => {
  it("renders poster clue with strictly generic alt text", () => {
    render(<ClueRenderer clue={mockActiveRound.clue} />);

    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("alt", "Movie poster clue");
    expect(img.getAttribute("alt")).not.toContain("Fight Club");
  });

  it("renders title clue with masked letters", () => {
    render(
      <ClueRenderer
        clue={{
          mode: "title",
          maskedTitle: "F _ _ _ _   C _ _ _",
        }}
      />
    );

    expect(screen.getByText("Missing Title Clue")).toBeInTheDocument();
    expect(screen.getByText("F _ _ _ _ C _ _ _")).toBeInTheDocument();
  });

  it("preserves Unicode punctuation and lets long masked titles wrap without hiding clue", () => {
    const clue = "東_映画: 旅の_ / " + "_".repeat(90);
    render(<ClueRenderer clue={{ mode: "title", maskedTitle: clue }} />);
    const text = screen.getByLabelText(`Masked title: ${clue}`);
    expect(text).toHaveClass("wrap-anywhere", "whitespace-pre-wrap", "min-w-0");
    expect(text.textContent).toBe(clue);
  });

  it("renders synopsis clue with sanitized text and optional hints", () => {
    render(
      <ClueRenderer
        clue={{
          mode: "synopsis",
          synopsis: "An insomniac office worker looking for a way to change his life...",
          decade: "1990s",
        }}
      />
    );

    expect(screen.getByText(/An insomniac office worker/)).toBeInTheDocument();
    expect(screen.getByText("Era: 1990s")).toBeInTheDocument();
  });

  it("renders cast clue with director and cast members", () => {
    render(
      <ClueRenderer
        clue={{
          mode: "cast",
          director: "David Fincher",
          cast: ["Brad Pitt", "Edward Norton"],
        }}
      />
    );

    expect(screen.getByText("David Fincher")).toBeInTheDocument();
    expect(screen.getByText("Brad Pitt")).toBeInTheDocument();
    expect(screen.getByText("Edward Norton")).toBeInTheDocument();
  });

  it("renders genre clue with tags and era", () => {
    render(
      <ClueRenderer
        clue={{
          mode: "genre",
          genres: ["Drama", "Thriller"],
          decade: "1990s",
        }}
      />
    );

    expect(screen.getByText("Drama")).toBeInTheDocument();
    expect(screen.getByText("Thriller")).toBeInTheDocument();
    expect(screen.getByText("1990s")).toBeInTheDocument();
  });
});

describe("TerminalRevealView", () => {
  it("renders outcome details and waits for explicit Next click", () => {
    const handleNext = vi.fn();
    render(
      <TerminalRevealView
        reveal={mockTerminalReveal}
        currentRound={1}
        totalRounds={10}
        onNext={handleNext}
        isAdvancing={false}
      />
    );

    expect(screen.getByText("Correct answer!")).toBeInTheDocument();
    expect(screen.getByText("Fight Club")).toBeInTheDocument();
    expect(screen.getByText(/1999/)).toBeInTheDocument();
    expect(screen.getByText("David Fincher")).toBeInTheDocument();
    expect(screen.getByText(/Brad Pitt/)).toBeInTheDocument();
    expect(screen.getByText("Round score: 60 pts")).toBeInTheDocument();

    const nextBtn = screen.getByRole("button", { name: /Next Round \(2\/10\)/i });
    expect(handleNext).not.toHaveBeenCalled();

    fireEvent.click(nextBtn);
    expect(handleNext).toHaveBeenCalledTimes(1);
  });
});

describe("Gameplay Reducer", () => {
  it("transitions through guess submission and handles correct outcome", () => {
    const startState = gameplayReducer(initialGameplayState, {
      type: "GUESS_START",
      actionId: "act-123",
      payload: { answerText: "Fight Club" },
    });
    expect(startState.status).toBe("submitting");
    expect(startState.lastActionId).toBe("act-123");

    const updatedSession: SafeSessionDto = {
      ...mockSession,
      score: 100,
      active_round: {
        ...mockActiveRound,
        state: "correct",
        reveal: mockTerminalReveal,
      },
    };

    const successState = gameplayReducer(startState, {
      type: "GUESS_SUCCESS",
      result: {
        outcome: "correct",
        is_duplicate: false,
        points: 100,
        wrong_attempts: 0,
        session: updatedSession,
      },
    });

    expect(successState.status).toBe("idle");
    expect(successState.session?.score).toBe(100);
    expect(successState.feedback?.tone).toBe("success");
    expect(successState.lastActionId).toBeNull();
  });

  it("handles ambiguous outcome by setting ambiguityChoices and retaining input", () => {
    const startState: GameplayState = {
      ...initialGameplayState,
      typedGuess: "Avatar",
    };

    const ambiguityState = gameplayReducer(startState, {
      type: "GUESS_SUCCESS",
      result: {
        outcome: "ambiguous",
        is_duplicate: false,
        points: 0,
        wrong_attempts: 0,
        choices: [
          { choiceHandle: "h-1", title: "Avatar", releaseYear: 2009 },
          { choiceHandle: "h-2", title: "Avatar", releaseYear: 2022 },
        ],
        session: mockSession,
      },
    });

    expect(ambiguityState.ambiguityChoices).toHaveLength(2);
    expect(ambiguityState.typedGuess).toBe("Avatar");
    expect(ambiguityState.feedback?.tone).toBe("info");
  });

  it("handles duplicate wrong answer without consuming attempts", () => {
    const duplicateState = gameplayReducer(initialGameplayState, {
      type: "GUESS_SUCCESS",
      result: {
        outcome: "wrong",
        is_duplicate: true,
        points: 0,
        wrong_attempts: 1,
        session: mockSession,
      },
    });

    expect(duplicateState.feedback?.text).toContain("already guessed");
    expect(duplicateState.feedback?.tone).toBe("info");
  });

  it("reconciles state on STALE_RELOAD without losing valid data", () => {
    const errorState: GameplayState = {
      ...initialGameplayState,
      status: "error",
      error: { code: "REVISION_MISMATCH", message: "Stale state", retryable: true },
      lastActionId: "old-act",
    };

    const reloaded = gameplayReducer(errorState, {
      type: "STALE_RELOAD",
      session: { ...mockSession, revision: 3 },
    });

    expect(reloaded.status).toBe("idle");
    expect(reloaded.error).toBeNull();
    expect(reloaded.session?.revision).toBe(3);
    expect(reloaded.feedback?.text).toContain("synced with server");
  });
});

describe("GameplayShell Component", () => {
  beforeEach(() => {
    mockPush.mockReset();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads session and renders active clue, score, attempts, and hint button", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockSession,
    } as Response);

    render(<GameplayShell sessionId="session-1" />);

    expect(screen.getByText(/Loading session/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole("img", { name: "Movie poster clue" })).toBeInTheDocument();
    });

    expect(screen.getByText("1/10")).toBeInTheDocument();
    expect(screen.getByText(/3 attempts left/i)).toBeInTheDocument();
    expect(screen.getByText("Score")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Hint 1/i })).toBeInTheDocument();
  });

  it("confirms quit action with 24-hour resumability message", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockSession,
    } as Response);

    render(<GameplayShell sessionId="session-1" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Exit Game/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Exit Game/i }));

    expect(
      screen.getByText(/Your progress is preserved for 24 hours/i)
    ).toBeInTheDocument();

    // Clicking confirm exit routes home
    fireEvent.click(screen.getByRole("button", { name: "Confirm Exit" }));
    expect(mockPush).toHaveBeenCalledWith("/");
  });

  it("confirms skip round and requests skip API", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSession,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          ...mockSession,
          active_round: {
            ...mockActiveRound,
            state: "skipped",
            reveal: { ...mockTerminalReveal, outcome: "skipped", score: 0 },
          },
        }),
      } as Response);

    render(<GameplayShell sessionId="session-1" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Skip Round/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Skip Round/i }));

    expect(
      screen.getByText(/Skip this round\? You will receive 0 points/i)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Confirm Skip/i }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/games/session-1/skip",
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  it("resyncs session on 409 revision conflict", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
      // Initial load
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSession,
      } as Response)
      // Guess returns 409
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ error: { code: "REVISION_MISMATCH", message: "Conflict" } }),
      } as Response)
      // Re-sync fetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          ...mockSession,
          revision: 2,
        }),
      } as Response);

    render(<GameplayShell sessionId="session-1" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Submit Guess/i })).toBeInTheDocument();
    });

    // Enter guess
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "Fight Club" } });

    // Submit guess
    fireEvent.click(screen.getByRole("button", { name: /Submit Guess/i }));

    await waitFor(() => {
      // Third call should be the resync GET
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/games/session-1",
        expect.objectContaining({ headers: { Accept: "application/json" } })
      );
    });
  });

  it("clears action ID when dismissing failed action", () => {
    const state = gameplayReducer({ ...initialGameplayState, status: "error", error: { code: "FAIL", message: "failed", retryable: true }, lastActionId: "previous-action", lastActionPayload: { type: "hint" } }, { type: "CLEAR_ERROR" });
    expect(state.lastActionId).toBeNull();
    expect(state.lastActionPayload).toBeNull();
  });

  it("retries exact guess payload and action ID after network failure", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => mockSession } as Response)
      .mockRejectedValueOnce(new Error("connection lost"))
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => ({ outcome: "wrong", is_duplicate: false, points: 0, wrong_attempts: 1, session: {
          ...mockSession, revision: 1, active_round: { ...mockActiveRound, wrong_attempts: 1 },
        } }),
      } as Response);

    render(<GameplayShell sessionId="session-1" />);
    const input = await screen.findByRole("combobox");
    fireEvent.change(input, { target: { value: "Fictional wrong title" } });
    fireEvent.click(screen.getByRole("button", { name: /Submit Guess/i }));
    await screen.findByRole("button", { name: "Retry" });
    fireEvent.change(input, { target: { value: "Changed text" } });
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.getByText("2 attempts left")).toBeInTheDocument());
    const requests = fetchSpy.mock.calls.filter(([url]) => String(url).endsWith("/guess"));
    expect(requests).toHaveLength(2);
    expect(requests[1][1]?.body).toEqual(requests[0][1]?.body);
  });
});
