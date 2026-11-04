export type DifficultyLevel = "easy" | "medium" | "hard";

export const BASE_SCORES: Record<DifficultyLevel, number> = {
  easy: 100,
  medium: 150,
  hard: 200,
};

export const WRONG_ATTEMPT_PENALTY = 25;
export const HINT_PENALTY = 20;

/**
 * Calculates points for a correct round answer per PRD Section 7:
 * max(0, base - 25*wrongAttempts - 20*hintsUsed)
 */
export function calculateRoundScore(
  level: DifficultyLevel,
  wrongAttempts: number,
  hintsUsed: number
): number {
  const base = BASE_SCORES[level] ?? 100;
  const attempts = Math.max(0, Math.min(2, wrongAttempts));
  const hints = Math.max(0, Math.min(3, hintsUsed));
  const deduction = attempts * WRONG_ATTEMPT_PENALTY + hints * HINT_PENALTY;
  return Math.max(0, base - deduction);
}
