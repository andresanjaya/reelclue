import "server-only";
import { buildSafeClue, type ClueMode, type MovieDetails, type SafeClue } from "./clues.ts";
import type { SessionLevel, SessionMode } from "./selection.ts";

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
    title: movie.title || "Unknown Title",
    original_title: movie.original_title || movie.title || "Unknown Title",
    release_year: typeof movie.release_year === "number" ? movie.release_year : 0,
    genres: Array.isArray(movie.genres) ? [...movie.genres] : [],
    directors: Array.isArray(movie.directors) ? movie.directors.map(d => d?.name).filter(Boolean) : [],
    cast: Array.isArray(movie.cast_members) ? movie.cast_members.slice(0, 5).map(c => c?.name).filter(Boolean) : [],
    synopsis: movie.sanitized_synopsis || null,
    poster_path: movie.poster_path || null,
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

export type GameResultsRoundSummary = {
  ordinal: number;
  mode: ClueMode;
  reveal: TerminalReveal;
};

export type GameResultsDto = {
  id: string;
  mode: SessionMode;
  level: SessionLevel;
  state: "completed";
  score: number;
  max_score: number;
  accuracy: number;
  correct_count: number;
  total_rounds: number;
  total_hints_used: number;
  total_wrong_attempts: number;
  completed_at: string;
  rounds: GameResultsRoundSummary[];
};

export function serializeGameResults(
  session: DbSession,
  roundPairs: Array<{ round: DbRound; movie: MovieDetails }>
): GameResultsDto {
  // ponytail: fixed 10-round max scores; upgrade when custom round counts or scoring bonuses added
  const maxScore = session.level === "easy" ? 1000 : session.level === "medium" ? 1500 : 2000;
  const correctCount = roundPairs.filter(rp => rp.round.state === "correct").length;
  const totalHints = roundPairs.reduce((sum, rp) => sum + rp.round.hint_stage, 0);
  const totalWrong = roundPairs.reduce((sum, rp) => sum + rp.round.wrong_attempts, 0);

  return {
    id: session.id,
    mode: session.mode as SessionMode,
    level: session.level as SessionLevel,
    state: "completed",
    score: session.score,
    max_score: maxScore,
    accuracy: Math.round((correctCount / roundPairs.length) * 100),
    correct_count: correctCount,
    total_rounds: roundPairs.length,
    total_hints_used: totalHints,
    total_wrong_attempts: totalWrong,
    completed_at: session.completed_at ?? new Date().toISOString(),
    rounds: roundPairs.map(rp => ({
      ordinal: rp.round.ordinal,
      mode: rp.round.mode,
      reveal: serializeTerminalReveal(rp.round, rp.movie),
    })),
  };
}
