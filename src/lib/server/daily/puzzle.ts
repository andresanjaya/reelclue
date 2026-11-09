import "server-only";
import { createHash } from "node:crypto";
import {
  CatalogShortageError,
  selectGameRounds,
  type PoolCandidate,
  type SelectedRound,
} from "../game/selection.ts";

/**
 * Returns current UTC date string in "YYYY-MM-DD" format.
 */
export function getUtcDateString(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Returns the exact Date of the upcoming UTC midnight (00:00:00.000Z).
 */
export function getNextUtcMidnight(d: Date = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0, 0));
}

/**
 * Returns the whole number of seconds remaining until the next UTC midnight.
 */
export function getSecondsUntilUtcMidnight(d: Date = new Date()): number {
  const next = getNextUtcMidnight(d);
  const diffMs = next.getTime() - d.getTime();
  return Math.max(0, Math.floor(diffMs / 1000));
}

/**
 * Mulberry32 32-bit seeded pseudo-random number generator.
 * Produces uniform float in [0, 1) deterministically across all environments.
 */
export function createDeterministicRng(seedString: string): () => number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedString.length; i++) {
    h = Math.imul(h ^ seedString.charCodeAt(i), 16777619);
  }
  let a = h >>> 0;
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generates an RFC-4122 v4 UUID deterministically from a seed string.
 */
export function createDeterministicUuid(seed: string): string {
  const hex = createHash("sha256").update(seed).digest("hex");
  const p1 = hex.slice(0, 8);
  const p2 = hex.slice(8, 12);
  const p3 = "4" + hex.slice(13, 16);
  const variantByte = (parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80;
  const p4 = variantByte.toString(16).padStart(2, "0") + hex.slice(18, 20);
  const p5 = hex.slice(20, 32);
  return `${p1}-${p2}-${p3}-${p4}-${p5}`;
}

/**
 * Generates a stable 10-round Mixed/Medium daily puzzle for a specific UTC date and catalog version.
 * Same date + catalog version guarantees the exact same movies, modes, and round order.
 */
export function generateDailyRounds(
  candidates: PoolCandidate[],
  dateStr: string,
  catalogVersionId: string
): SelectedRound[] {
  // Daily challenge strictly targets the "medium" tier
  const mediumCandidates = candidates.filter(c => c.tier === "medium");
  const pool = mediumCandidates.length >= 10 ? mediumCandidates : candidates;

  if (pool.length < 10) {
    throw new CatalogShortageError("Not enough eligible movies in catalog for Daily Challenge.");
  }

  // Seed with "daily:<dateStr>:<catalogVersionId>"
  const seedString = `daily:${dateStr}:${catalogVersionId}`;
  const rng = createDeterministicRng(seedString);

  // Generate 10 balanced mixed rounds (2 of each of the 5 clue modes)
  const rounds = selectGameRounds(pool, "mixed", [], rng);

  // Ensure reveal seeds are also fully deterministic
  return rounds.map(r => ({
    ...r,
    reveal_seed: createDeterministicUuid(`reveal:${dateStr}:${catalogVersionId}:${r.ordinal}:${r.movie_id}`),
  }));
}

