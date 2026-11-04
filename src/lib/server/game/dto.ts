import "server-only";
import { buildSafeClue, type ClueMode, type MovieDetails, type SafeClue } from "./clues.ts";

export type RoundState = "guessing" | "correct" | "skipped" | "exhausted";

export type DbRound = {
  id: string;
  session_id: string;
  ordinal: number;
  movie_id: number;
  mode: ClueMode;
  hint_stage: number;
  wrong_attempts: number;
  state: RoundState;
  score: number;
  reveal_seed: string;
  reveal_snapshot?: Record<string, unknown> | null;
};

export type DbSession = {
  id: string;
  player_id: string;
  mode: string;
  level: string;
  state: "active" | "completed" | "expired";
  current_round: number;
  score: number;
  revision: number;
  created_at: string;
  expires_at: string;
  completed_at: string | null;
};

export type TerminalReveal = {
  tmdb_id: number;
  title: string;
  original_title: string;
  release_year: number;
  genres: string[];
  directors: string[];
  cast: string[];
  synopsis: string | null;
  poster_path: string | null;
  outcome: RoundState;
  score: number;
  hints_used: number;
  wrong_attempts: number;
};

export type SafeActiveRoundDto = {
  id: string;
  ordinal: number;
  mode: ClueMode;
  hint_stage: number;
  wrong_attempts: number;
  state: RoundState;
  score: number;
  clue: SafeClue;
  reveal: TerminalReveal | null;
};

export type CompletedRoundSummary = {
  ordinal: number;
  reveal: TerminalReveal;
};

export type GuessOutcome = "correct" | "wrong" | "ambiguous";

export type AmbiguousChoice = {
  choiceHandle: string;
  title: string;
  releaseYear: number;
};

export type GuessResponseDto = {
  outcome: GuessOutcome;
  is_duplicate: boolean;
  points: number;
  wrong_attempts: number;
  message?: string;
  choices?: AmbiguousChoice[];
  session: SafeSessionDto;
};

export type SafeSessionDto = {
  id: string;
  mode: string;
  level: string;
  state: "active" | "completed" | "expired";
  current_round: number;
  score: number;
  revision: number;
  active_round: SafeActiveRoundDto;
  completed_rounds: CompletedRoundSummary[];
};

export function serializeTerminalReveal(round: DbRound, movie: MovieDetails): TerminalReveal {
  return {
    tmdb_id: movie.tmdb_id,
    title: movie.title,
    original_title: movie.original_title,
    release_year: movie.release_year,
    genres: [...movie.genres],
    directors: movie.directors.map(d => d.name),
    cast: movie.cast_members.slice(0, 5).map(c => c.name),
    synopsis: movie.sanitized_synopsis,
    poster_path: movie.poster_path,
    outcome: round.state,
    score: round.score,
    hints_used: round.hint_stage,
    wrong_attempts: round.wrong_attempts,
  };
}

export function serializeActiveRound(
  round: DbRound,
  movie: MovieDetails,
  sessionId: string
): SafeActiveRoundDto {
  const isTerminal = round.state !== "guessing";
  return {
    id: round.id,
    ordinal: round.ordinal,
    mode: round.mode,
    hint_stage: round.hint_stage,
    wrong_attempts: round.wrong_attempts,
    state: round.state,
    score: round.score,
    clue: buildSafeClue(round.mode, round.hint_stage, movie, sessionId, round.id, round.reveal_seed),
    reveal: isTerminal ? serializeTerminalReveal(round, movie) : null,
  };
}

export function serializeGameSession(
  session: DbSession,
  activeRound: DbRound,
  activeMovie: MovieDetails,
  completedRounds: Array<{ round: DbRound; movie: MovieDetails }> = []
): SafeSessionDto {
  return {
    id: session.id,
    mode: session.mode,
    level: session.level,
    state: session.state,
    current_round: session.current_round,
    score: session.score,
    revision: session.revision,
    active_round: serializeActiveRound(activeRound, activeMovie, session.id),
    completed_rounds: completedRounds
      .filter(cr => cr.round.ordinal < session.current_round || session.state === "completed")
      .map(cr => ({
        ordinal: cr.round.ordinal,
        reveal: serializeTerminalReveal(cr.round, cr.movie),
      })),
  };
}
