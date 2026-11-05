import type { Metadata } from "next";
import { cookies } from "next/headers";
import {
  fetchGameResults,
  GameError,
  hashToken,
  PLAYER_COOKIE_NAME,
} from "@/lib/server/game/session";
import type { GameResultsDto } from "@/lib/server/game/dto";
import {
  ResultsErrorView,
  ResultsIncompleteView,
  ResultsView,
} from "@/features/game/results-view";

export const metadata: Metadata = {
  title: "Game Results — ReelClue",
  description: "View your completed ReelClue movie trivia results and round breakdown.",
};

type ResultLoadError =
  | { type: "unauthorized" }
  | { type: "incomplete" }
  | { type: "not_found" }
  | { type: "expired" }
  | { type: "general"; message: string };

export default async function ResultsPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;

  const cookieStore = await cookies();
  const playerToken = cookieStore.get(PLAYER_COOKIE_NAME)?.value;

  let results: GameResultsDto | null = null;
  let loadError: ResultLoadError | null = null;

  if (!playerToken) {
    loadError = { type: "unauthorized" };
  } else {
    try {
      results = await fetchGameResults(id, hashToken(playerToken));
    } catch (err) {
      if (err instanceof GameError) {
        if (err.status === 409) {
          loadError = { type: "incomplete" };
        } else if (err.status === 404) {
          loadError = { type: "not_found" };
        } else if (err.status === 410) {
          loadError = { type: "expired" };
        } else {
          loadError = { type: "general", message: err.message || "Failed to load game results." };
        }
      } else {
        loadError = {
          type: "general",
          message: "An unexpected error occurred while loading your results.",
        };
      }
    }
  }

  if (loadError) {
    if (loadError.type === "unauthorized") {
      return (
        <ResultsErrorView
          title="Session Not Found"
          message="No anonymous player session found on this device."
        />
      );
    }
    if (loadError.type === "incomplete") {
      return <ResultsIncompleteView sessionId={id} />;
    }
    if (loadError.type === "not_found") {
      return (
        <ResultsErrorView
          title="Game Not Found"
          message="This game session does not exist or was created on another device."
        />
      );
    }
    if (loadError.type === "expired") {
      return (
        <ResultsErrorView
          title="Session Expired"
          message="This game session results have expired. Completed results are retained for 30 days."
        />
      );
    }
    return (
      <ResultsErrorView
        title="Results Unavailable"
        message={loadError.message}
      />
    );
  }

  return <ResultsView results={results!} />;
}
