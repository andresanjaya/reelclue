import type {
  AmbiguousChoice,
  GuessResponseDto,
  SafeSessionDto,
} from "@/lib/server/game/dto";
import type { MovieChoice } from "./answer-combobox";

export type GameplayStatus =
  | "loading"
  | "idle"
  | "submitting"
  | "hinting"
  | "skipping"
  | "advancing"
  | "completed"
  | "error"
  | "expired";

export interface GameplayError {
  code: string;
  message: string;
  retryable: boolean;
  action?: "load" | "guess" | "hint" | "skip" | "next";
}

export interface GameplayState {
  status: GameplayStatus;
  session: SafeSessionDto | null;
  error: GameplayError | null;
  lastActionId: string | null;
  lastActionPayload: {
    type: "guess" | "hint" | "skip" | "next";
    answerText?: string;
    choiceHandle?: string;
  } | null;
  confirmingSkip: boolean;
  confirmingQuit: boolean;
  ambiguityChoices: AmbiguousChoice[] | null;
  typedGuess: string;
  selectedChoice: MovieChoice | null;
  feedback: {
    text: string;
    tone: "info" | "success" | "error";
  } | null;
}

export type GameplayAction =
  | { type: "LOAD_START" }
  | { type: "LOAD_SUCCESS"; session: SafeSessionDto }
  | { type: "LOAD_ERROR"; error: { code: string; message: string; retryable: boolean } }
  | { type: "GUESS_START"; actionId: string; payload: { answerText?: string; choiceHandle?: string } }
  | { type: "GUESS_SUCCESS"; result: GuessResponseDto }
  | { type: "GUESS_ERROR"; error: { code: string; message: string; retryable: boolean } }
  | { type: "HINT_START"; actionId: string }
  | { type: "HINT_SUCCESS"; session: SafeSessionDto }
  | { type: "HINT_ERROR"; error: { code: string; message: string; retryable: boolean } }
  | { type: "SKIP_START"; actionId: string }
  | { type: "SKIP_SUCCESS"; session: SafeSessionDto }
  | { type: "SKIP_ERROR"; error: { code: string; message: string; retryable: boolean } }
  | { type: "NEXT_START"; actionId: string }
  | { type: "NEXT_SUCCESS"; session: SafeSessionDto }
  | { type: "NEXT_ERROR"; error: { code: string; message: string; retryable: boolean } }
  | { type: "SET_TYPED_GUESS"; value: string }
  | { type: "SET_SELECTED_CHOICE"; choice: MovieChoice | null }
  | { type: "SET_CONFIRMING_SKIP"; value: boolean }
  | { type: "SET_CONFIRMING_QUIT"; value: boolean }
  | { type: "CLEAR_ERROR" }
  | { type: "STALE_RELOAD"; session: SafeSessionDto };

export const initialGameplayState: GameplayState = {
  status: "loading",
  session: null,
  error: null,
  lastActionId: null,
  lastActionPayload: null,
  confirmingSkip: false,
  confirmingQuit: false,
  ambiguityChoices: null,
  typedGuess: "",
  selectedChoice: null,
  feedback: null,
};

export function gameplayReducer(
  state: GameplayState,
  action: GameplayAction
): GameplayState {
  switch (action.type) {
    case "LOAD_START":
      return {
        ...state,
        status: "loading",
        error: null,
      };

    case "LOAD_SUCCESS":
      return {
        ...state,
        status: action.session.state === "completed" ? "completed" : "idle",
        session: action.session,
        error: null,
      };

    case "LOAD_ERROR":
      if (action.error.code === "SESSION_EXPIRED") {
        return {
          ...state,
          status: "expired",
          error: { ...action.error, action: "load" },
        };
      }
      return {
        ...state,
        status: "error",
        error: { ...action.error, action: "load" },
      };

    case "GUESS_START":
      return {
        ...state,
        status: "submitting",
        lastActionId: action.actionId,
        lastActionPayload: { type: "guess", ...action.payload },
        error: null,
        feedback: null,
      };

    case "GUESS_SUCCESS": {
      const isCorrect = action.result.outcome === "correct";
      const isAmbiguous = action.result.outcome === "ambiguous";
      const isDuplicate = action.result.is_duplicate;
      const isExhausted = action.result.session.active_round.state === "exhausted";

      let feedback: { text: string; tone: "info" | "success" | "error" } | null = null;
      if (isAmbiguous) {
        feedback = {
          text: action.result.message || "More than one movie has this title. Choose the release year.",
          tone: "info",
        };
      } else if (isCorrect) {
        feedback = {
          text: `Correct! You earned +${action.result.points} points.`,
          tone: "success",
        };
      } else if (isDuplicate) {
        feedback = {
          text: "You already guessed that wrong answer. No attempt consumed.",
          tone: "info",
        };
      } else if (isExhausted) {
        feedback = {
          text: "All 3 attempts used. Round ended.",
          tone: "error",
        };
      } else {
        const remaining = Math.max(0, 3 - action.result.wrong_attempts);
        feedback = {
          text: `Wrong guess! ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`,
          tone: "error",
        };
      }

      return {
        ...state,
        status: "idle",
        session: action.result.session,
        lastActionId: null,
        lastActionPayload: null,
        ambiguityChoices: isAmbiguous ? action.result.choices ?? null : null,
        typedGuess: isDuplicate ? state.typedGuess : isAmbiguous ? state.typedGuess : "",
        selectedChoice: isDuplicate ? state.selectedChoice : isAmbiguous ? state.selectedChoice : null,
        feedback,
      };
    }

    case "GUESS_ERROR":
      return {
        ...state,
        status: "error",
        error: { ...action.error, action: "guess" },
      };

    case "HINT_START":
      return {
        ...state,
        status: "hinting",
        lastActionId: action.actionId,
        lastActionPayload: { type: "hint" },
        error: null,
      };

    case "HINT_SUCCESS":
      return {
        ...state,
        status: "idle",
        session: action.session,
        lastActionId: null,
        lastActionPayload: null,
        feedback: {
          text: "Hint revealed (-20 pts).",
          tone: "info",
        },
      };

    case "HINT_ERROR":
      return {
        ...state,
        status: "error",
        error: { ...action.error, action: "hint" },
      };

    case "SKIP_START":
      return {
        ...state,
        status: "skipping",
        confirmingSkip: false,
        lastActionId: action.actionId,
        lastActionPayload: { type: "skip" },
        error: null,
      };

    case "SKIP_SUCCESS":
      return {
        ...state,
        status: "idle",
        session: action.session,
        lastActionId: null,
        lastActionPayload: null,
        typedGuess: "",
        selectedChoice: null,
        feedback: {
          text: "Round skipped. 0 points awarded.",
          tone: "info",
        },
      };

    case "SKIP_ERROR":
      return {
        ...state,
        status: "error",
        error: { ...action.error, action: "skip" },
      };

    case "NEXT_START":
      return {
        ...state,
        status: "advancing",
        lastActionId: action.actionId,
        lastActionPayload: { type: "next" },
        error: null,
      };

    case "NEXT_SUCCESS":
      return {
        ...state,
        status: action.session.state === "completed" ? "completed" : "idle",
        session: action.session,
        lastActionId: null,
        lastActionPayload: null,
        typedGuess: "",
        selectedChoice: null,
        ambiguityChoices: null,
        feedback: null,
      };

    case "NEXT_ERROR":
      return {
        ...state,
        status: "error",
        error: { ...action.error, action: "next" },
      };

    case "SET_TYPED_GUESS":
      return {
        ...state,
        typedGuess: action.value,
        selectedChoice: null,
        ambiguityChoices: null,
      };

    case "SET_SELECTED_CHOICE":
      return {
        ...state,
        selectedChoice: action.choice,
        typedGuess: action.choice ? action.choice.title : state.typedGuess,
        ambiguityChoices: null,
      };

    case "SET_CONFIRMING_SKIP":
      return {
        ...state,
        confirmingSkip: action.value,
      };

    case "SET_CONFIRMING_QUIT":
      return {
        ...state,
        confirmingQuit: action.value,
      };

    case "CLEAR_ERROR":
      return {
        ...state,
        status: state.session?.state === "completed" ? "completed" : "idle",
        error: null,
        lastActionId: null,
        lastActionPayload: null,
      };

    case "STALE_RELOAD":
      return {
        ...state,
        status: action.session.state === "completed" ? "completed" : "idle",
        session: action.session,
        error: null,
        lastActionId: null,
        lastActionPayload: null,
        feedback: {
          text: "Session state synced with server.",
          tone: "info",
        },
      };

    default:
      return state;
  }
}
