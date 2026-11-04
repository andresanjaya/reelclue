import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "../../src/app/page";
import { PlaySetup } from "../../src/features/game/play-setup";

// Mock next/navigation
const mockPush = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => mockSearchParams,
}));

describe("Home page", () => {
  it("renders brand pitch, How to Play, and play action", () => {
    render(<Home />);

    expect(screen.getAllByText("ReelClue")[0]).toBeInTheDocument();
    expect(screen.getByText("Every clue brings you closer.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "How to play" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "A clue for every movie mind" })).toBeInTheDocument();

    // Verify all 6 modes are linked
    const links = screen.getAllByRole("link");
    const modeLinks = links.filter(l => l.getAttribute("href")?.startsWith("/play?mode="));
    expect(modeLinks).toHaveLength(6);

    // Verify TMDB attribution
    expect(screen.getByText(/This product uses the TMDB API/)).toBeInTheDocument();
  });

  it("has no login wall, timers, or account requirements", () => {
    render(<Home />);

    expect(screen.queryByRole("button", { name: /log in|sign in|register/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/password|username|email/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("timer")).not.toBeInTheDocument();
  });
});

describe("PlaySetup component", () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockSearchParams = new URLSearchParams();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("defaults to Poster Blur mode and Easy level", () => {
    render(<PlaySetup />);

    const posterRadio = screen.getByRole("radio", { name: /Poster Blur/ });
    expect(posterRadio).toBeChecked();

    const easyRadio = screen.getByRole("radio", { name: /Easy/ });
    expect(easyRadio).toBeChecked();
  });

  it("preselects mode from query parameters when valid", () => {
    mockSearchParams = new URLSearchParams("mode=cast");
    render(<PlaySetup />);

    const castRadio = screen.getByRole("radio", { name: /Director & Cast/ });
    expect(castRadio).toBeChecked();

    const posterRadio = screen.getByRole("radio", { name: /Poster Blur/ });
    expect(posterRadio).not.toBeChecked();
  });

  it("double-tap guard prevents multiple session creation requests", async () => {
    let resolveGame: (val: unknown) => void;
    const gamePromise = new Promise(resolve => {
      resolveGame = resolve;
    });

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url: RequestInfo | URL) => {
      const urlStr = String(url);
      if (urlStr.includes("/api/player")) {
        return { ok: true, json: async () => ({ ok: true }) } as Response;
      }
      if (urlStr.includes("/api/games")) {
        return gamePromise as Promise<Response>;
      }
      return { ok: true } as Response;
    });

    render(<PlaySetup />);
    const submitBtn = screen.getByRole("button", { name: /Start Game/ });

    // Double click rapidly
    fireEvent.click(submitBtn);
    fireEvent.click(submitBtn);

    // Wait for the single call to /api/games to be dispatched
    await waitFor(() => {
      const gameCalls = fetchSpy.mock.calls.filter(call => String(call[0]).includes("/api/games"));
      expect(gameCalls).toHaveLength(1);
    });

    // Resolve the creation
    resolveGame!({
      ok: true,
      status: 201,
      json: async () => ({ id: "new-session-123" }),
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/play/new-session-123");
    });
  });

  it("handles catalog shortage without changing player's mode and difficulty selections", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url: RequestInfo | URL) => {
      const urlStr = String(url);
      if (urlStr.includes("/api/player")) {
        return { ok: true, json: async () => ({ ok: true }) } as Response;
      }
      if (urlStr.includes("/api/games")) {
        return {
          ok: false,
          status: 400,
          json: async () => ({
            error: {
              code: "CATALOG_SHORTAGE",
              message: "Not enough movies for this mode and difficulty combination",
            },
          }),
        } as Response;
      }
      return { ok: true } as Response;
    });

    render(<PlaySetup />);

    // Select Hard and Synopsis
    fireEvent.click(screen.getByRole("radio", { name: /Synopsis/ }));
    fireEvent.click(screen.getByRole("radio", { name: /Hard/ }));

    const submitBtn = screen.getByRole("button", { name: /Start Game/ });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Not enough movies");
    });

    // Selections must remain intact!
    expect(screen.getByRole("radio", { name: /Synopsis/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /Hard/ })).toBeChecked();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("handles network failure and allows retry", async () => {
    let failFirst = true;

    vi.spyOn(globalThis, "fetch").mockImplementation(async (url: RequestInfo | URL) => {
      const urlStr = String(url);
      if (urlStr.includes("/api/player")) {
        return { ok: true, json: async () => ({ ok: true }) } as Response;
      }
      if (urlStr.includes("/api/games")) {
        if (failFirst) {
          failFirst = false;
          throw new Error("Network error");
        }
        return {
          ok: true,
          status: 201,
          json: async () => ({ id: "retry-session-456" }),
        } as Response;
      }
      return { ok: true } as Response;
    });

    render(<PlaySetup />);
    const submitBtn = screen.getByRole("button", { name: /Start Game/ });

    // First attempt fails
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Network connection error");
    });

    // Button should be re-enabled
    expect(submitBtn).not.toBeDisabled();

    // Retry succeeds
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/play/retry-session-456");
    });
  });
});
