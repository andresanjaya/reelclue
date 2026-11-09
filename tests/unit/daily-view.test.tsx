import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DailyView } from "../../src/features/daily/daily-view";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe("DailyView component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders daily challenge details and Start Official Challenge button when unstarted", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url: RequestInfo | URL) => {
      const u = String(url);
      if (u.includes("/api/player")) {
        return { ok: true, json: async () => ({ ok: true }) } as Response;
      }
      if (u.includes("/api/daily")) {
        return {
          ok: true,
          json: async () => ({
            challengeDate: "2026-11-09",
            resetAt: "2026-11-10T00:00:00.000Z",
            secondsUntilReset: 7200,
            hasOfficialAttempt: false,
            officialSession: null,
            canStartOfficial: true,
            canResume: false,
            practiceAttemptsCount: 0,
          }),
        } as Response;
      }
      return { ok: true } as Response;
    });

    render(<DailyView />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Daily Challenge" })).toBeInTheDocument();
    });

    expect(screen.getByText(/Mixed Clues/)).toBeInTheDocument();
    expect(screen.getByText(/10 Rounds/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Start Official Challenge/ })).toBeInTheDocument();
  });

  it("starts official challenge and navigates to session on click", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url: RequestInfo | URL) => {
      const u = String(url);
      if (u.includes("/api/player")) {
        return { ok: true, json: async () => ({ ok: true }) } as Response;
      }
      if (u.includes("/api/daily/play")) {
        return {
          ok: true,
          status: 201,
          json: async () => ({ sessionId: "new-daily-sess-789", isOfficial: true, isResumed: false }),
        } as Response;
      }
      if (u.includes("/api/daily")) {
        return {
          ok: true,
          json: async () => ({
            challengeDate: "2026-11-09",
            resetAt: "2026-11-10T00:00:00.000Z",
            secondsUntilReset: 7200,
            hasOfficialAttempt: false,
            officialSession: null,
            canStartOfficial: true,
            canResume: false,
            practiceAttemptsCount: 0,
          }),
        } as Response;
      }
      return { ok: true } as Response;
    });

    render(<DailyView />);

    const startBtn = await screen.findByRole("button", { name: /Start Official Challenge/ });
    fireEvent.click(startBtn);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/play/new-daily-sess-789");
    });
  });

  it("renders Resume Challenge link when official challenge is in progress", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url: RequestInfo | URL) => {
      const u = String(url);
      if (u.includes("/api/player")) {
        return { ok: true, json: async () => ({ ok: true }) } as Response;
      }
      if (u.includes("/api/daily")) {
        return {
          ok: true,
          json: async () => ({
            challengeDate: "2026-11-09",
            resetAt: "2026-11-10T00:00:00.000Z",
            secondsUntilReset: 7200,
            hasOfficialAttempt: true,
            officialSession: {
              id: "active-daily-sess-111",
              state: "active",
              score: 420,
              currentRound: 5,
            },
            canStartOfficial: false,
            canResume: true,
            practiceAttemptsCount: 0,
          }),
        } as Response;
      }
      return { ok: true } as Response;
    });

    render(<DailyView />);

    await waitFor(() => {
      expect(screen.getByText(/Challenge In Progress/)).toBeInTheDocument();
    });

    expect(screen.getByText(/Round 5 of 10/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Resume Challenge/ })).toHaveAttribute(
      "href",
      "/play/active-daily-sess-111"
    );
  });

  it("renders completed state with score, View Results link, and Play Practice Round button", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url: RequestInfo | URL) => {
      const u = String(url);
      if (u.includes("/api/player")) {
        return { ok: true, json: async () => ({ ok: true }) } as Response;
      }
      if (u.includes("/api/daily")) {
        return {
          ok: true,
          json: async () => ({
            challengeDate: "2026-11-09",
            resetAt: "2026-11-10T00:00:00.000Z",
            secondsUntilReset: 7200,
            hasOfficialAttempt: true,
            officialSession: {
              id: "completed-daily-sess-222",
              state: "completed",
              score: 850,
              currentRound: 10,
            },
            canStartOfficial: false,
            canResume: false,
            practiceAttemptsCount: 0,
          }),
        } as Response;
      }
      return { ok: true } as Response;
    });

    render(<DailyView />);

    await waitFor(() => {
      expect(screen.getByText(/Today's Challenge Completed!/)).toBeInTheDocument();
    });

    expect(screen.getByText(/850 pts/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View Results/ })).toHaveAttribute(
      "href",
      "/results/completed-daily-sess-222"
    );
    expect(screen.getByRole("button", { name: /Play Practice Round/ })).toBeInTheDocument();
  });
});

