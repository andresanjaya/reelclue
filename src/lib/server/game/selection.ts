import "server-only";
import { type ClueMode } from "./clues.ts";
export type { ClueMode };

export type SessionMode = ClueMode | "mixed";
export type SessionLevel = "easy" | "medium" | "hard";

export const allClueModes: ClueMode[] = ["poster", "title", "synopsis", "cast", "genre"];

export type PoolCandidate = {
  tmdb_id: number;
  tier: string;
  eligible_modes: string[];
};

export type SelectedRound = {
  ordinal: number;
  movie_id: number;
  mode: ClueMode;
  reveal_seed: string;
};

export class CatalogShortageError extends Error {
  readonly code = "CATALOG_SHORTAGE";
  readonly retryable = false;
  constructor(message = "Not enough movies for this combination. Try another mode or level.") {
    super(message);
    this.name = "CatalogShortageError";
  }
}

function shuffleArray<T>(items: T[], rng: () => number = Math.random): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

export function selectSingleModeMovies(
  candidates: PoolCandidate[],
  mode: ClueMode,
  recentMovieIds: number[] = [],
  rng: () => number = Math.random
): number[] {
  const eligible = candidates.filter(c => c.eligible_modes.includes(mode));
  const recentSet = new Set(recentMovieIds.slice(0, 30));

  const preferred = eligible.filter(c => !recentSet.has(c.tmdb_id));
  const poolToUse = preferred.length >= 10 ? preferred : eligible;

  if (poolToUse.length < 10) {
    throw new CatalogShortageError();
  }

  const shuffled = shuffleArray(poolToUse, rng);
  return shuffled.slice(0, 10).map(c => c.tmdb_id);
}

export function solveMixedDistribution(
  candidates: PoolCandidate[],
  recentMovieIds: number[] = [],
  rng: () => number = Math.random
): Array<{ movie_id: number; mode: ClueMode }> {
  // ponytail: capped at 30 recent movie IDs; upgrade to player-profile preference window if needed
  const recentSet = new Set(recentMovieIds.slice(0, 30));

  // First try with recent movies excluded
  const preferred = candidates.filter(c => !recentSet.has(c.tmdb_id));
  let result: Array<{ movie_id: number; mode: ClueMode }> | null = null;

  if (preferred.length >= 10) {
    result = tryMixedAllocation(preferred, rng);
  }

  // If preferred pool cannot satisfy allocation, relax recent exclusions (never relax tier gate)
  if (!result && preferred.length < candidates.length) {
    result = tryMixedAllocation(candidates, rng);
  }

  if (!result) {
    throw new CatalogShortageError();
  }

  return shuffleArray(result, rng);
}

function tryMixedAllocation(
  candidates: PoolCandidate[],
  rng: () => number = Math.random
): Array<{ movie_id: number; mode: ClueMode }> | null {
  if (candidates.length < 10) return null;

  // Most constrained eligibility pools first
  const modeCounts = allClueModes.map(mode => ({
    mode,
    eligible: candidates.filter(c => c.eligible_modes.includes(mode)),
  }));
  modeCounts.sort((a, b) => a.eligible.length - b.eligible.length);

  // If any mode has fewer than 2 candidates, allocation is immediately impossible
  if (modeCounts.some(mc => mc.eligible.length < 2)) return null;

  const shuffledCandidates = shuffleArray(candidates, rng);

  const attemptCounter = { attempts: 0 };
  const assignment: Array<{ movie_id: number; mode: ClueMode }> = [];
  const assignedIds = new Set<number>();

  const success = backtrack(0, modeCounts, shuffledCandidates, assignedIds, assignment, attemptCounter);
  return success ? assignment : null;
}

function backtrack(
  modeIdx: number,
  modeCounts: Array<{ mode: ClueMode; eligible: PoolCandidate[] }>,
  allCandidates: PoolCandidate[],
  assignedIds: Set<number>,
  assignment: Array<{ movie_id: number; mode: ClueMode }>,
  counter: { attempts: number }
): boolean {
  if (modeIdx === modeCounts.length) {
    return assignment.length === 10;
  }

  const { mode } = modeCounts[modeIdx];
  const available = allCandidates.filter(c => c.eligible_modes.includes(mode) && !assignedIds.has(c.tmdb_id));

  if (available.length < 2) return false;

  // Try pairs deterministically
  for (let i = 0; i < available.length - 1; i++) {
    for (let j = i + 1; j < available.length; j++) {
      counter.attempts++;
      if (counter.attempts > 100) {
        return false; // Bounded backtracking (max 100 attempts)
      }

      const c1 = available[i];
      const c2 = available[j];

      assignedIds.add(c1.tmdb_id);
      assignedIds.add(c2.tmdb_id);
      assignment.push({ movie_id: c1.tmdb_id, mode });
      assignment.push({ movie_id: c2.tmdb_id, mode });

      if (backtrack(modeIdx + 1, modeCounts, allCandidates, assignedIds, assignment, counter)) {
        return true;
      }

      // Backtrack
      assignment.pop();
      assignment.pop();
      assignedIds.delete(c1.tmdb_id);
      assignedIds.delete(c2.tmdb_id);
    }
  }

  return false;
}

export function selectGameRounds(
  candidates: PoolCandidate[],
  mode: SessionMode,
  recentMovieIds: number[] = [],
  rng: () => number = Math.random
): SelectedRound[] {
  let pairs: Array<{ movie_id: number; mode: ClueMode }>;

  if (mode === "mixed") {
    pairs = solveMixedDistribution(candidates, recentMovieIds, rng);
  } else {
    const movieIds = selectSingleModeMovies(candidates, mode, recentMovieIds, rng);
    pairs = movieIds.map(movie_id => ({ movie_id, mode }));
  }

  return pairs.map((pair, idx) => ({
    ordinal: idx + 1,
    movie_id: pair.movie_id,
    mode: pair.mode,
    reveal_seed: crypto.randomUUID(),
  }));
}
